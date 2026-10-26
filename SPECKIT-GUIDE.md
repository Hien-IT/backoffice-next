# Hướng dẫn Spec Kit: clone Directus sang Nx (NestJS + Vue)

Tài liệu này hướng dẫn dùng Spec Kit để xây app mới dựa trên code mẫu Directus 11.17.4 trong `directus/`. Mỗi phần có
prompt sẵn để dán vào Claude Code (mở ở thư mục `backoffice-next/`).

---

## 1. Các quyết định đã chốt

| Chủ đề             | Quyết định                                                                                                                                                                                                                                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code mẫu           | `directus/` (Directus 11.17.4, api 35.2.0, app 15.10.0). **Chỉ đọc, không sửa.** Được copy code sang app mới.                                                                                                                                                                                                                                                  |
| Cấu trúc           | Nx monorepo tại `backoffice-next/`: `apps/api` (NestJS), `apps/web` (Vue 3), `libs/*` dùng chung.                                                                                                                                                                                                                                                              |
| Database           | Dùng **chung DB** với Directus. Hỗ trợ mọi DB Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB) qua **Knex**.                                                                                                                                                                                                                      |
| Migration          | Directus chạy migration cho bảng `directus_*`. **Feature 021** (constitution 3.0.0): Backoffice cũng tự khởi tạo DB và migrate như Directus với Postgres, SQLite. App mới kiểm tra phiên bản migration khi khởi động. **Feature 022** (constitution 3.2.0): Backoffice có migration riêng trong bảng `backoffice_migrations`, không ghi `directus_migrations`. |
| API                | REST **giống hệt** Directus: path, query, response, mã lỗi. `@directus/sdk` dùng được.                                                                                                                                                                                                                                                                         |
| Auth               | **Token dùng chéo**: chung `SECRET`, chung bảng `directus_sessions`, chung static token.                                                                                                                                                                                                                                                                       |
| Cache              | **Chung Redis**: cùng format cache key và kênh bus, sửa ở app này thì app kia xóa cache ngay.                                                                                                                                                                                                                                                                  |
| Flows              | Flow theo lịch: **lock qua Redis**, mỗi lượt chỉ một app chạy. Flow theo sự kiện: app nào nhận request thì app đó chạy.                                                                                                                                                                                                                                        |
| FE                 | **Viết mới** bằng Vue 3 + **Reka UI** (cùng thư viện Directus app dùng), giữ nguyên luồng màn hình của Directus. Phần nhìn và bố cục khung theo **`design-system/`** (dựa trên TailAdmin, theme `brand-*`/`gray-*`, constitution XII từ 2.0.0).                                                                                                                |
| Extensions         | **Feature 020**: extension đã build cho Directus chạy trên API và app mới (mọi loại trừ `theme`), marketplace, sandbox, nhiều instance (constitution 2.1.0).                                                                                                                                                                                                   |
| Biến môi trường    | **Kế thừa toàn bộ** biến của Directus: cùng tên, cùng mặc định, cùng cách ép kiểu. Dùng lại nguyên file `.env`, ConfigMap, Secret của Directus khi deploy.                                                                                                                                                                                                     |
| Ngôn ngữ           | spec, plan, tasks viết **tiếng Việt**. Tên biến, comment, commit message viết **tiếng Anh**.                                                                                                                                                                                                                                                                   |
| Runtime            | **Node 22 + pnpm 10**, giống Directus.                                                                                                                                                                                                                                                                                                                         |
| CI                 | **GitHub Actions**. Coverage tối thiểu **80% BE, 60% FE**.                                                                                                                                                                                                                                                                                                     |
| DB chính           | **PostgreSQL**: chạy đủ test ở mọi PR. MySQL, SQLite chạy bộ rút gọn. MSSQL, Oracle, CockroachDB chạy hằng đêm.                                                                                                                                                                                                                                                |
| Hiệu năng          | p95 latency và throughput **không tệ hơn Directus quá 10%**.                                                                                                                                                                                                                                                                                                   |
| Ngôn ngữ giao diện | **vi-VN và en-US**.                                                                                                                                                                                                                                                                                                                                            |
| Giám sát           | **Log JSON** giống Directus và **metrics Prometheus** (`/metrics`).                                                                                                                                                                                                                                                                                            |
| SSO                | **OpenID Connect, OAuth2, LDAP** (từ constitution 1.3.0). SAML chưa làm.                                                                                                                                                                                                                                                                                       |
| Storage            | **S3/MinIO** và **Local**. Azure, GCS, Cloudinary, Supabase chưa làm.                                                                                                                                                                                                                                                                                          |
| Email              | **Không gửi email.** Luồng cần email vẫn chạy như Directus, phần gửi mail bị bỏ qua và ghi log cảnh báo.                                                                                                                                                                                                                                                       |
| Flow Run Script    | **Có**, chạy trong sandbox isolated-vm giống Directus.                                                                                                                                                                                                                                                                                                         |
| Layouts            | Table, Cards, Calendar, Kanban, Map: đủ cả 5.                                                                                                                                                                                                                                                                                                                  |
| Quy mô             | **Lớn**: 200–2.000 user đồng thời, collection lớn nhất khoảng 10 triệu bản ghi.                                                                                                                                                                                                                                                                                |
| Thiết bị           | **Desktop và tablet** (từ 768px), Chrome, Edge, Firefox, Safari bản mới.                                                                                                                                                                                                                                                                                       |
| Thương hiệu        | Chữ "Directus" trong app mới đổi thành **"Backoffice"**, trừ những chỗ ảnh hưởng luồng hoặc tương thích (bảng `directus_*`, JWT issuer, cookie, namespace Redis, tên biến môi trường...).                                                                                                                                                                      |
| Phạm vi            | Lõi dữ liệu, Files & assets, Flows & tự động hóa, Insights/dashboards, GraphQL, Translations, Versions, Shares. **Không làm Realtime WebSocket.**                                                                                                                                                                                                              |

---

## 2. Quy trình Spec Kit cho mỗi feature

```
/speckit.constitution   (chạy 1 lần cho cả dự án)
        │
        ▼  lặp lại cho từng feature, theo thứ tự ở mục 5
/speckit.specify  →  /speckit.clarify  →  /speckit.plan  →  /speckit.checklist
        →  /speckit.tasks  →  /speckit.analyze  →  /speckit.implement
```

| Lệnh                 | Làm gì                                        | Ghi chú                                                               |
| -------------------- | --------------------------------------------- | --------------------------------------------------------------------- |
| `/speckit.specify`   | Viết spec: **làm gì và vì sao**               | Không ghi tech stack ở đây. Mô tả hành vi, luồng, tiêu chí chấp nhận. |
| `/speckit.clarify`   | Claude hỏi tối đa 5 câu để làm rõ spec        | Nên chạy với feature lớn.                                             |
| `/speckit.plan`      | Viết plan kỹ thuật: **làm thế nào**           | Đây là chỗ ghi NestJS, Knex, Reka UI, file Directus cần tham chiếu.   |
| `/speckit.checklist` | Tạo checklist kiểm tra chất lượng yêu cầu     | Tùy chọn.                                                             |
| `/speckit.tasks`     | Chia plan thành task có thứ tự                |                                                                       |
| `/speckit.analyze`   | Kiểm tra spec, plan, tasks có khớp nhau không | Chạy trước khi implement.                                             |
| `/speckit.implement` | Code theo tasks                               |                                                                       |

**Ba nguyên tắc khi viết spec:**

1. **Mỗi spec một feature vừa phải.** Đừng gộp cả Directus vào một spec. Lộ trình ở mục 5 đã chia sẵn.
2. **Spec mô tả hành vi, plan mô tả công nghệ.** Ví dụ trong spec viết "người dùng lọc item theo `_eq`, `_in`... giống
   Directus". Trong plan mới viết "port `api/src/database/run-ast/lib/apply-query` sang NestJS".
3. **Luôn chỉ ra file tham chiếu trong `directus/`.** Claude sẽ đọc code gốc để giữ đúng luồng.

---

## 3. Chuẩn bị trước khi chạy Spec Kit (đã làm sẵn)

1. **Git ở thư mục gốc**, nhánh `main`. Spec Kit tạo một branch cho mỗi feature (`001-...`, `002-...`). `directus/` được
   đưa vào repo để Claude tìm kiếm được trong code mẫu. File bị `.gitignore` sẽ không hiện khi tìm kiếm.
2. **Chưa tạo Nx workspace.** Việc tạo workspace bằng `create-nx-workspace` nằm trong feature `001`, để Spec Kit ghi lại
   đầy đủ.
3. **Directus 11.17.4 tham chiếu** ở `dev/directus-reference/`, gồm Postgres (PostGIS), Redis và MinIO (S3), tắt
   WebSocket giống phạm vi app mới. App mới sẽ trỏ vào cùng DB, Redis và storage này.

   | Dịch vụ  | Địa chỉ                                                      |
   | -------- | ------------------------------------------------------------ |
   | Directus | http://localhost:8055                                        |
   | Postgres | localhost:5432                                               |
   | Redis    | localhost:6379                                               |
   | MinIO    | http://localhost:9000 (API), http://localhost:9001 (console) |

   Tài khoản admin, mật khẩu DB, `SECRET` và key MinIO nằm trong `dev/directus-reference/.env`. File này sinh ngẫu nhiên
   và không đưa vào git.

   ```bash
   cd dev/directus-reference
   docker compose up -d --wait   # bật
   docker compose down           # tắt, giữ dữ liệu
   docker compose down -v        # tắt và xóa toàn bộ dữ liệu
   ```

   Môi trường triển khai đầy đủ (Directus + BE nhiều replica + FE sau load balancer) là `deploy/compose` của feature
   019, xem `deploy/README.md`; `dev/directus-reference` giữ cho test đối chiếu.

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
- Backoffice chạy được cùng Directus trên một DB hoặc một mình, không cần Directus.
- Được khởi tạo DB và chạy migration giống Directus 11.17.4: CLI bootstrap, database install, database migrate:latest|up|down. Seed và 101 migration hệ thống là bản port nguyên văn từ directus/api/src/database/{seeds,migrations}, ghim ở 11.17.4, cùng custom migration trong MIGRATIONS_PATH. Chỉ Postgres và SQLite; vendor khác thì DB do Directus khởi tạo và migrate.
- Không thêm bảng, cột hay migration hệ thống riêng của Backoffice. Ngoài seed và migration port từ Directus, không tạo, sửa, xóa bảng hệ thống directus_* hay cột gốc của chúng. DB do Backoffice tạo phải dùng được với Directus 11.17.4 và ngược lại. Được, như Directus: thêm, sửa, xóa cột người dùng trong collection hệ thống qua API fields; tạo, xóa index trên cột hệ thống qua schema.is_indexed.
- Khi khởi động (sau bootstrap), app mới đối chiếu bảng directus_migrations với danh sách migration của 11.17.4. Lệch thì dừng và báo lỗi rõ ràng.
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
- Khi chạy nhiều instance, Redis là bắt buộc cho cache, bus, rate limiter, lock flow theo lịch và lock upload TUS. Không dùng cache hay lock trong bộ nhớ process làm nguồn dữ liệu duy nhất. Cache trong process chỉ được phép khi được dựng lại từ DB hoặc Redis và bị xóa qua bus Redis trên mọi instance, như Directus.
- File và ảnh đã transform lưu trên storage dùng chung (S3, GCS, Azure hoặc volume dùng chung). Không dùng storage local riêng từng container.
- Khi chạy nhiều instance, extension nạp từ storage dùng chung (EXTENSIONS_LOCATION) hoặc đóng sẵn vào mọi image; cài, gỡ, bật tắt reload mọi instance (cả Directus) qua bus Redis như Directus.
- Khởi động nhiều replica cùng lúc phải an toàn: chỉ đọc và kiểm tra migration, không ghi gì vào bảng hệ thống khi khởi động (ngoại lệ: dòng `directus_extensions` cho extension mới thấy lần đầu, như Directus, có khóa Redis, constitution 2.2.0; lệnh bootstrap, constitution 3.0.0: image chạy bootstrap rồi start như Directus; chế độ chung thì mỗi replica như một container Directus; chế độ độc lập nhiều replica thì bootstrap chạy một lần trong Helm Job pre-install/pre-upgrade hoặc service chạy một lần của compose; không có lock như Directus).
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

XII. Giao diện theo design-system
- design-system/ (dựa trên TailAdmin, MIT) là nguồn chuẩn phần nhìn và bố cục khung của apps/web. Luồng màn hình, route và hành vi vẫn theo Directus app (VI).
- Spec, plan và component FE phải đọc trước design-system/README.md, docs/component-specs.md, docs/layout-patterns.md, qa/handoff-checklist.md.
- Màu, font, cỡ chữ, shadow chỉ lấy từ theme design-system/tokens/theme.css với tên của TailAdmin (brand-*, gray-*, success-*, warning-*, error-*...). Không dùng mã hex thô, không dùng màu palette Tailwind ngoài theme này.
- apps/web dùng Tailwind 4: chép theme bằng @theme, chế độ tối theo class dark trên html.
- Component theo quy ước của docs/component-specs.md: Reka UI, script setup TS, modelValue/update:modelValue, đủ state, dùng được bằng bàn phím, label và lỗi liên kết với control.
- Theme design-system là giá trị mặc định. Branding trong settings áp lên trên như Directus: project_color cho nền logo, trang public (đăng nhập), trang share, favicon và meta theme-color (không đổi màu primary của app); theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ.
- design-system/components/*.vue chỉ là ví dụ. Kiểm tra export Reka UI theo bản đã cài. Code TailAdmin chỉ để tham khảo; chép đoạn nào thì giữ thông báo MIT.
- Màu dùng công thức đạt WCAG AA trong docs/component-specs.md (bảng tương phản ở docs/migration-guide.md). Màn hay thành phần design-system chưa có mẫu (ví dụ màn CMS riêng) phải ghi thành câu hỏi mở trong spec, không tự chọn.

XI. Ngoài phạm vi giai đoạn này
- SSO bằng SAML (làm OpenID Connect, OAuth2, LDAP). Storage Azure, GCS, Cloudinary, Supabase (chỉ làm Local và S3/tương thích S3). Gửi email.
- Realtime WebSocket: /websocket, GraphQL subscription, collaborative editing, system logs realtime. /server/info trả websocket: false, giống Directus khi WEBSOCKETS_ENABLED=false. App web ẩn các tính năng này như Directus app.
- Extension loại theme, AI/MCP, module deployment của Directus (deploy lên Vercel, Netlify...), visual editing, telemetry. Các loại extension khác làm ở feature 020.

Quy trình sửa constitution: mọi thay đổi phải ghi lý do, tăng phiên bản theo semver và cập nhật lại các template liên quan.
```

### Sửa constitution cho 021 (2.2.0 → 3.0.0)

Feature 021 trái với Nguyên tắc II ("Không chạy migration hệ thống. Chỉ Directus được migrate.") và VII ("KHÔNG ghi gì
vào bảng hệ thống khi khởi động"). Chạy prompt sau trước `/speckit.specify` của 021, rồi cho tech lead duyệt. Đã chạy
ngày 2026-10-22: constitution 3.0.0, prompt nguồn mục II, VII ở trên đã sửa theo; tech lead (chủ dự án) duyệt
2026-10-22.

```text
/speckit.constitution Sửa constitution 2.2.0 thành 3.0.0 (MAJOR: định nghĩa lại Nguyên tắc II) cho feature 021: Backoffice chạy độc lập, tự khởi tạo DB và chạy migration giống Directus 11.17.4. Lý do: <lý do nghiệp vụ>.

II. Dùng chung database với Directus
- Backoffice chạy được cùng Directus trên một DB (như hiện nay) hoặc một mình, không cần Directus.
- Được khởi tạo DB và chạy migration giống Directus 11.17.4: CLI bootstrap, database install, database migrate:latest|up|down. Seed và 101 migration hệ thống là bản port nguyên văn từ directus/api/src/database/{seeds,migrations}, ghim ở 11.17.4, cùng custom migration trong MIGRATIONS_PATH.
- Backoffice tự khởi tạo và migrate với Postgres và SQLite. Vendor khác: DB do Directus khởi tạo và migrate, Backoffice chỉ kiểm tra directus_migrations.
- Không thêm bảng, cột hay migration hệ thống riêng của Backoffice. DB do Backoffice tạo phải dùng được với Directus 11.17.4 và ngược lại.
- Giữ nguyên: kiểm tra directus_migrations lúc khởi động (sau bootstrap), định dạng dữ liệu giống hệt Directus, cột người dùng trong collection hệ thống qua API fields.

VII. Triển khai đa instance
- Thêm ngoại lệ thứ hai cho câu "KHÔNG ghi gì vào bảng hệ thống khi khởi động": lệnh bootstrap. Image API mặc định chạy bootstrap rồi start như Dockerfile của Directus; ở chế độ chạy chung mỗi replica khởi động như một container Directus. Ở chế độ độc lập với nhiều replica, bootstrap chạy một lần trong Helm Job pre-install/pre-upgrade hoặc service chạy một lần của compose; các replica chỉ chạy start. Bootstrap không có lock, như Directus.

Giữ nguyên V (Directus vẫn là mốc test đối chiếu) và XI (khi chạy độc lập, các tính năng ngoài phạm vi như gửi email, WebSocket, SAML, storage ngoài Local/S3 không có).

Cập nhật Sync Impact Report, .specify/templates/plan-template.md (dòng II, VII) và SPECKIT-GUIDE.md (prompt nguồn mục II, VII).
```

### Sửa constitution cho 022 (3.1.0 → 3.2.0)

Feature 022 trái với Nguyên tắc II ("KHÔNG ĐƯỢC thêm bảng, cột hay migration hệ thống riêng của Backoffice") và VII
("bootstrap không có lock, như Directus"). Chạy prompt sau trước `/speckit.plan` của 022, rồi cho tech lead duyệt. Đã
chạy ngày 2026-10-26: constitution 3.2.0, theo yêu cầu của chủ dự án (kiêm tech lead).

```text
/speckit.constitution Sửa constitution 3.1.0 thành 3.2.0 (MINOR: thêm ngoại lệ vào Nguyên tắc II và VII) cho feature 022: Backoffice có migration riêng để thêm cấu hình mà Directus không có, bắt đầu bằng ba cột ẩn hiện ô tìm kiếm, Import, Export trên directus_collections. Lý do: chủ dự án cần nhiều migration riêng về sau và không muốn đụng vào Directus đang chạy chung DB.

II. Dùng chung database với Directus (thêm các ý sau, giữ nguyên các ý còn lại)
- Backoffice được có bộ migration riêng. Trạng thái ghi trong bảng hệ thống backoffice_migrations (version, name, timestamp, cùng dạng directus_migrations); Backoffice coi bảng này là collection hệ thống như directus_migrations. Backoffice không ghi, không xóa dòng nào trong directus_migrations; Directus không cần file, biến môi trường hay cấu hình mới.
- Migration riêng chỉ được: tạo bảng tiền tố backoffice_; thêm cột tiền tố bo_ vào bảng directus_*; thêm dòng directus_fields của các cột đó. Không được sửa, xóa bảng hay cột gốc của Directus.
- Mỗi migration riêng chỉ có up, chỉ dùng knex, chạy được trên 7 vendor, chạy lại được trên DB đã có thay đổi của nó. Không có down và không có lệnh CLI riêng; rollback làm tay trên DB.
- bootstrap chạy migration riêng còn thiếu trên mọi vendor, sau khi migration Directus đã đủ (sửa D-145 của 021: Backoffice vẫn chỉ cài và migrate Directus trên Postgres, SQLite). Lúc start, migration riêng thiếu hoặc lạ thì dừng và báo rõ, như migration Directus.
- DB do Backoffice tạo vẫn dùng được với Directus 11.17.4 và ngược lại; Directus chỉ thấy thêm cột bo_* và bảng backoffice_* (bảng chưa quản lý trong Data Model). GET /collections của hai app khác nhau ở các bảng backoffice_* (ghi thành khác biệt).

VII. Triển khai đa instance
- Thêm ngoại lệ cho "bootstrap không có lock, như Directus": migration riêng của Backoffice chạy dưới lock dùng chung (Redis khi có cấu hình Redis), mỗi lúc một process; migration Directus trong bootstrap vẫn không có lock.

Giữ nguyên V (test đối chiếu so dump DB, bỏ qua bảng backoffice_*, cột bo_* và dòng directus_fields của chúng).

Cập nhật Sync Impact Report, .specify/templates/plan-template.md (dòng II, VII) và SPECKIT-GUIDE.md (prompt nguồn mục II, VII).
```

---

## 5. Lộ trình feature

Làm theo thứ tự. Mỗi dòng là một lần `/speckit.specify`.

| #   | Feature                                                                                                         | Phụ thuộc | Mảng   |
| --- | --------------------------------------------------------------------------------------------------------------- | --------- | ------ |
| 001 | Nền tảng workspace và kết nối hệ thống                                                                          | –         | BE     |
| 002 | Schema overview và cache dùng chung                                                                             | 001       | BE     |
| 003 | Xác thực và phiên đăng nhập                                                                                     | 002       | BE     |
| 004 | Phân quyền (roles, policies, permissions, users)                                                                | 003       | BE     |
| 005 | CRUD items, response cache, export, event (engine đã port ở 004)                                                | 004       | BE     |
| 006 | Quản lý data model (collections, fields, relations, schema)                                                     | 005       | BE     |
| 007 | Files, folders, assets                                                                                          | 005       | BE     |
| 008 | Activity, revisions, versions, comments                                                                         | 005       | BE     |
| 009 | Flows và tự động hóa                                                                                            | 005, 008  | BE     |
| 010 | Collection hệ thống còn lại (settings, presets, notifications, shares, translations, dashboards, panels, utils) | 005       | BE     |
| 011 | GraphQL                                                                                                         | 005–010   | BE     |
| 012 | Khung app web và đăng nhập                                                                                      | 003       | FE     |
| 013 | Bộ interfaces và displays                                                                                       | 012       | FE     |
| 014 | Module Content                                                                                                  | 013       | FE     |
| 015 | Module Files và Users                                                                                           | 013       | FE     |
| 016 | Module Settings: data model, quyền, cài đặt                                                                     | 013       | FE     |
| 017 | Trình chỉnh sửa Flows                                                                                           | 016       | FE     |
| 018 | Insights, Activity, Notifications                                                                               | 013       | FE     |
| 019 | Đóng gói và triển khai đa instance (Docker, K8s)                                                                | 001, 012  | DevOps |
| 020 | Extensions (API, app, marketplace, sandbox, nhiều instance)                                                     | 009–019   | BE, FE |
| 021 | Chạy độc lập: khởi tạo DB, migration và CLI giống Directus                                                      | 001–019   | BE     |
| 022 | Ẩn hiện ô tìm kiếm, Import, Export theo collection, migration riêng của Backoffice                              | 014, 021  | BE, FE |

**Mẹo:** API mới giống hệt Directus, nên FE (012–018) có thể bắt đầu ngay, trỏ vào Directus thật. Khi BE xong thì đổi
URL sang NestJS. Hai mảng chạy song song được.

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

### 005: CRUD items, response cache, export, event

Engine đọc và ghi (`ItemsService`, `PayloadService`, `MetaService`, `get-ast-from-query`, `run-ast`, `apply-query`,
dialect helper) và kiểm query đã port đủ ở feature 004. Feature này chỉ thêm phần còn lại.

```text
/speckit.specify Người dùng thao tác dữ liệu của mọi collection qua /items/:collection giống hệt Directus: đọc danh sách, đọc theo id, tạo, sửa, xóa từng cái hoặc hàng loạt, SEARCH, collection singleton. Engine đọc ghi (ItemsService, PayloadService, MetaService, run-ast, apply-query) và kiểm query đã port ở feature 004, nên feature này dùng lại, không port lại. Thêm: cache response khi CACHE_ENABLED=true (CACHE_TTL, CACHE_AUTO_PURGE, CACHE_STATUS_HEADER, Cache-Control, dùng chung key với Directus, gỡ D-11), xuất file qua query export (json, csv, xml, yaml, gỡ D-12), phát cùng tên event như Directus (items.create, items.update... và event của năm collection hệ thống, gỡ D-29 phần filter và action cho flow), và đẩy sự kiện lên kênh bus websocket.event của Directus (cùng format như directus/api/src/websocket/controllers/hooks.ts, gỡ D-30). Tham chiếu directus/api/src/controllers/items.ts, middleware/respond.ts, middleware/cache.ts, utils/get-cache-key.ts, services/import-export, emitter.ts. Tiêu chí chấp nhận: bộ blackbox test items, query và relational của Directus chạy qua trên app mới với Postgres, MySQL và SQLite.
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
/speckit.specify Xây app web quản trị mới mang tên Backoffice thay cho Directus app, giữ nguyên luồng sử dụng. Mọi chữ Directus mà người dùng thấy (tiêu đề, logo, favicon, trang đăng nhập, chuỗi dịch, tên mặc định khi project_name trống) đổi thành Backoffice. Nếu settings trong DB đã có tên dự án, logo hoặc màu riêng thì dùng các giá trị đó, giống Directus. Người dùng đăng nhập bằng email và mật khẩu, TFA, LDAP hoặc SSO (OpenID Connect, OAuth2), rồi được giữ phiên bằng refresh token. Đăng xuất, quên mật khẩu, nhận lời mời (giữ màn hình như Directus; vì hệ thống không gửi email nên hiện thêm hướng dẫn liên hệ admin), cập nhật hồ sơ, theme sáng/tối, ngôn ngữ vi-VN và en-US (dùng chuỗi dịch của Directus). Bố cục gồm thanh module bên trái, thanh điều hướng, vùng nội dung và sidebar bên phải như Directus. Các route giống Directus (/admin/content, /admin/files, /admin/users, /admin/insights, /admin/activity, /admin/settings). App chỉ gọi API theo đúng chuẩn Directus, nên chạy được với cả Directus thật lẫn API mới chỉ bằng cách đổi URL. Hỗ trợ desktop và tablet từ 768px trên Chrome, Edge, Firefox, Safari bản mới. Phần nhìn (màu, chữ, khoảng cách, bo góc, component) theo bộ design-system/ của dự án; màu, logo trong settings áp lên trên design-system như Directus (project_color tô nền logo, trang đăng nhập, trang share, favicon; theme sáng/tối tùy chỉnh trong settings đè màu tương ứng); những chỗ design-system chưa chốt (màu primary, font, màu trạng thái, theme tối) ghi thành câu hỏi mở. Tham chiếu directus/app/src (router, auth, stores, views) và design-system/. Tiêu chí chấp nhận: đăng nhập vào Directus thật và vào API mới đều chạy, điều hướng giữa các module giống Directus.
```

Ghi chú: prompt trên là bản gốc. Sau Phase 11 của 012, bố cục khung và phần nhìn theo design-system TailAdmin (D-47,
D-52 trong spec 012), không còn giống Directus app.

### 013: Bộ interfaces và displays

```text
/speckit.specify App web cần bộ interface (ô nhập dữ liệu) và display (cách hiển thị giá trị) tương đương Directus, để form và bảng hiển thị đúng theo cấu hình field trong directus_fields (interface, options, display, display_options). Interfaces: input, textarea, code, rich text HTML, markdown, block editor, hash, boolean, datetime, slider, select (dropdown, radio, checkbox, multi, icon, color, tree), tags, file, image, files, map, list (repeater), quan hệ m2o, o2m, m2m, m2a, tree view, translations, nhóm field (accordion, detail, raw, tabs), presentation (divider, header, links, notice), autocomplete từ API. Displays tương ứng. Đọc đúng options đã lưu bởi Directus, để field cấu hình ở Directus hiển thị đúng ở app mới. Tham chiếu directus/app/src/interfaces và displays. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: mọi interface và display có sẵn trong Directus đều có bản tương ứng, và đọc được cấu hình hiện có.
```

### 014: Module Content

```text
/speckit.specify Người dùng duyệt và chỉnh sửa dữ liệu trong module Content giống Directus: danh sách collection theo nhóm và folder, xem item với các layout table, cards, calendar, kanban và map (nguồn tile bản đồ cấu hình được như Directus: Mapbox key hoặc tile server riêng), tìm kiếm, lọc, sắp xếp, chọn cột, lưu bookmark và preset, xuất và nhập dữ liệu, thao tác hàng loạt. Trang chi tiết item có form theo cấu hình field, điều kiện ẩn hiện field, validation, lưu và lưu tiếp, xóa, archive, sidebar revisions, comments, versions và chia sẻ. Hỗ trợ collection singleton. Chỉ hiện những gì user có quyền. Danh sách phải mượt với collection khoảng 10 triệu bản ghi (phân trang và đếm phía server). Tham chiếu directus/app/src/modules/content và layouts. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: các luồng chính của module Content trên Directus làm được tương tự trên app mới.
```

Ghi chú từ 013 (đưa vào spec 014): 013 chỉ làm component (form, interface, display, drawer), không có màn hình. 014
nhận: màn item `/content/:collection/:primaryKey` dùng `BoForm`, lưu item, hỏi `unsaved_changes` (FR-084 của 013); E2E
ba cấu hình và so payload ghi với Directus app trên bộ mẫu `apps/web/fixtures/interfaces` (dùng lại script seed); drawer
chọn item theo layout của preset và bộ lọc nâng cao (D-58); màn revisions, versions và chế độ so sánh (D-55); nội dung
module Content (D-40); sự kiện "flow đã chạy" của `header` để nạp lại item.

### 015: Module Files và Users

```text
/speckit.specify Module Files: thư viện file theo thư mục, tải lên (kéo thả, nhiều file, từ URL), xem trước, sửa metadata, chỉnh sửa ảnh (cắt, xoay), di chuyển và xóa, lọc và tìm kiếm. Module Users: danh sách user theo role, tạo user, mời user (không gửi email), sửa hồ sơ, đổi role và policy, khóa user, tạo static token, bật tắt TFA. Luồng và quyền giống Directus. Tham chiếu directus/app/src/modules/files và users. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: các luồng chính của hai module chạy giống Directus.
```

Ghi chú từ 013 (đưa vào spec 015): làm interface `_system` của `directus_users` (`system-language`, `system-theme`,
`system-theme-overrides`, `system-mfa-setup`, `system-token`, `system-input-password`, D-57) và trình chỉnh ảnh
(`image-editor.vue`, `PATCH /files/:id` multipart) dùng chung cho màn file và nút chỉnh ảnh của interface `file-image`
(D-59).

Ghi chú từ 014 (đưa vào spec 015): `/content/directus_users` và `/content/directus_files` (và item của chúng) đang
chuyển hướng sang `/users`, `/files` là khung module của 012 (D-72, `checkForSystem` trong
`apps/web/src/modules/content.ts`, bảng `accessibleSystemCollections` của `utils/get-item-route.ts`); 015 thay khung
bằng màn thật, giữ route. Danh sách file và user dùng lại phần đã có của 014: năm layout (`src/layouts`, `use-layout`),
`SearchInput` + `system-filter`, preset/bookmark (`use-preset`), panel chi tiết (`components/sidebar/*`: layout,
xuất/nhập, revisions, comments, shares), `DrawerCollection` theo layout của preset, `DrawerBatch`, recipe nháp Q-2 đến
Q-12 của `component-specs.md` và §8–§10 của `layout-patterns.md` (chờ design owner duyệt ở 014). `CardsHeader` bỏ
`extraSelection` và `Cards` bỏ slot `prepend` (chỉ module Files dùng): 015 thêm lại. Interface `_system` còn lại của 015
như ghi chú 013 (D-57).

### 016: Module Settings

```text
/speckit.specify Module Settings cho admin, giống Directus: data model (tạo và sửa collection, field, relation, sắp xếp và nhóm field, cấu hình interface và display, điều kiện, validation), roles và policies (gán quyền theo collection, action, field, điều kiện lọc), cài đặt dự án (tên, logo, màu, theme, ngôn ngữ, bản đồ, giới hạn file), presets và bookmarks, translations, thông tin hệ thống. Tham chiếu directus/app/src/modules/settings. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: data model và quyền tạo trên app mới dùng được ngay trên Directus.
```

Ghi chú từ 013 (đưa vào spec 016): làm form options của interface và display (`options` trong `index.ts` của 013 giữ sẵn
dữ liệu; `list` và `map` có options dạng component, D-56) và các interface `_system` còn lại (D-57, trừ
`system-mcp-prompts-collection-validation` vì AI, D-41).

Ghi chú từ 014 (đưa vào spec 016): các link của Content đang trỏ khung Settings của 012 (D-71) và phải mở được màn thật
với đúng route: menu bookmark role/global ở cây collection mở `/settings/presets/:id` (`NavigationBookmark.vue`), nút
"tạo collection" (admin, chưa có collection) mở `/settings/data-model/+` (`ContentNavigation.vue`, `NoCollections.vue`),
menu chuột phải "sửa collection" mở `/settings/data-model/:collection`. Chuyển hướng D-72 của 016: `directus_settings` →
`/settings/project`, `directus_collections` → `/settings/data-model`, `directus_roles` → `/settings/roles`,
`directus_presets` → `/settings/presets`, `directus_translations` → `/settings/translations`, `directus_flows` →
`/settings/flows` (`utils/get-item-route.ts`). Interface `_system` còn lại (D-57) trừ hai cái 014 đã làm
(`system-filter`, `system-input-translated-string`, D-73); màn presets của Settings dùng lại `system-filter`, layout
options và `BookmarkAdd` của 014.

Ghi chú từ 015 (đưa vào spec 016): menu "sửa role" của cây role ở module Users (admin, chuột phải và nút dòng) trỏ
`/settings/roles/:id` (D-85, `modules/users/components/UsersNavigation.vue`), phải mở màn role thật. Sáu interface
`_system` của màn user đã có (`system-language`, `system-input-password`, `system-token`, `system-mfa-setup`,
`system-theme`, `system-theme-overrides`); 016 làm phần còn lại của D-57. Màn cài đặt dự án dùng lại `system-theme` và
`system-theme-overrides` (dữ liệu theme tĩnh `apps/web/src/theme/theme-presets.json`, sinh bằng `web:sync-themes`).

### 017: Trình chỉnh sửa Flows

```text
/speckit.specify Admin tạo và chỉnh sửa flow bằng giao diện kéo thả như Directus: chọn trigger, thêm operation, nối nhánh resolve và reject, cấu hình từng operation, bật tắt flow, xem log các lần chạy. Nút chạy flow thủ công hiện trên trang item hoặc danh sách item. Tham chiếu directus/app/src/modules/settings/routes/flows và directus/app/src/operations. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: flow tạo ở app mới mở và sửa được trên Directus, và ngược lại.
```

Ghi chú từ 016 (đưa vào spec 017): mục "Flows" của sub-menu Settings và `/settings/flows(/*)` đang là khung của 012
(D-92 của 016); `/content/directus_flows` cũng trỏ về đó (D-72). Đã có sẵn ba interface `_system` mà màn flow dùng:
`system-manual-flow-select`, `system-collections`, `system-inline-fields` (port của Directus, 016).

### 018: Insights, Activity, Notifications

```text
/speckit.specify Module Insights: tạo dashboard, thêm và sắp xếp panel (metric, metric list, meter, time series, line chart, bar chart, pie chart, list, label, variable, relational variable), lọc theo biến dashboard. Module Activity: xem nhật ký hoạt động, lọc theo user, collection, hành động. Notifications: chuông thông báo, đánh dấu đã đọc, mở item liên quan. Luồng giống Directus. Tham chiếu directus/app/src/modules/insights, activity, directus/app/src/panels. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: dashboard tạo ở Directus hiển thị đúng trên app mới.
```

Ghi chú từ 014 (đưa vào spec 018): `/content/directus_dashboards` và `/content/directus_activity` chuyển hướng sang
`/insights`, `/activity` (khung của 012, D-72); 018 thay khung bằng màn thật, giữ route.

Ghi chú từ 015 (đưa vào spec 018): drawer thông báo chưa có danh sách upload TUS dở (D-90); khi 018 làm drawer thông báo
thì thêm danh sách này như Directus (`tusResumableUploadsChanged`), `utils/upload-file.ts` đã giữ việc tiếp tục upload
dở khi chọn lại cùng file.

Ghi chú từ 017 (đưa vào spec 018): `BoWorkspace` và `BoWorkspaceTile` (`src/components/workspace`, port của
`v-workspace`, `v-workspace-tile`) đã có cho canvas flows: kéo bám lưới 18 px, menu tile, `data-pos-x/y`; chưa có resize
và zoom mà dashboard Insights cần. `/content/directus_operations` không chuyển hướng, giống Directus (`get-route.ts`
không có dòng đó).

Ghi chú từ 016 (đưa vào spec 018): thông báo dạng snackbar của Directus vẫn là notice tại chỗ và hộp lỗi (D-66 của 013);
`settingsStore.updateSettings` và các màn Settings dùng `notify`/`showUnexpectedError`. Khi 018 làm Notifications thì
xét lại cách hiển thị này.

### 019: Đóng gói và triển khai đa instance

```text
/speckit.specify Đóng gói app mới để triển khai: FE chạy 1 container, BE chạy nhiều container sau load balancer, cùng DB và Redis với Directus. FE: image nginx phục vụ file tĩnh ở /admin, đọc URL API và cấu hình từ biến môi trường lúc container khởi động, fallback về index.html cho route của SPA. BE: image chạy được với số replica tùy ý, không cần sticky session, có readiness và liveness probe qua /server/health, tắt máy an toàn khi nhận SIGTERM (ngừng nhận request, chạy nốt request đang dở, đóng kết nối DB và Redis). Định tuyến chung một domain: /admin/* vào FE, các path còn lại vào BE. Cung cấp docker-compose cho máy dev (Directus 11.17.4, BE 2 replica, FE, Postgres, Redis, MinIO làm S3) và manifest Kubernetes hoặc Helm chart cho môi trường thật (Deployment, Service, Ingress, HPA cho BE, dùng lại nguyên ConfigMap và Secret đang cấp cho Directus, không khai báo lại biến). Thay một instance Directus bằng BE mới chỉ cần đổi image, giữ nguyên toàn bộ biến môi trường. Tiêu chí chấp nhận: với BE 3 replica cộng 1 Directus, các bài test sau đều đạt: đăng nhập rồi gọi API lần lượt vào từng replica; sửa schema ở một replica thì replica khác thấy ngay; flow theo lịch chỉ chạy một lần mỗi lượt; upload TUS nhiều chunk qua các replica khác nhau vẫn thành công; tắt một replica khi đang tải không làm lỗi request.
```

### 020: Extensions

```text
/speckit.specify Hỗ trợ extension của Directus 11.17.4 trên API mới và app web mới: extension đã build cho Directus chạy được mà không cần build lại. Gỡ D-37, phần extensions của D-45, phần Extensions/Marketplace của D-93. Loại trong phạm vi: interface, display, layout, module, panel, hook, endpoint, operation, bundle; ngoài phạm vi: theme. API: port directus/api/src/extensions (manager, get-extensions, sync, installation, sandbox, wrap-embeds); nạp hook (filter, action, init, schedule, embed), endpoint, operation với cùng context như Directus (services, database, getSchema, env, logger, emitter...); env EXTENSIONS_PATH, EXTENSIONS_LOCATION, EXTENSIONS_MUST_LOAD, EXTENSIONS_AUTO_RELOAD, EXTENSIONS_SANDBOX_MEMORY, EXTENSIONS_SANDBOX_TIMEOUT; extension sandboxed chạy trong isolated-vm; /extensions trả schema thật, PATCH bật tắt, cài gỡ từ registry (bỏ 503), GraphQL extensions và update_extensions_item theo cùng hành vi. Nhiều instance (compose N replica, k8s nhiều pod, HPA): mọi node trong pool, cả Directus lẫn Backoffice, nạp cùng một bộ extension; bắt buộc EXTENSIONS_LOCATION khi chạy nhiều replica và Helm kiểm tra lúc install; reload qua kênh bus chung extensions.reload (cùng payload partialSync, origin); hook schedule dùng cùng tên lock <tên>:<index> với Directus; pod chỉ ready sau khi sync và nạp xong. Web, tương thích hoàn toàn: nạp /extensions/sources/index.js, đăng ký lúc chạy vào registry interface, display, layout, module, panel, operation; shim toàn bộ 77 component toàn cục v-* (directus/app/src/components/register.ts), PrivateView, PublicView, SharedView, 7 directive toàn cục, inject useStores, useApi (AxiosInstance), useSdk, useExtensions, shared deps vue, vue-router, vue-i18n, pinia, @directus/extensions-sdk, biến CSS --theme--* ánh xạ sang token. Shim theo design-system/ (TailAdmin): bọc Bo* khi đã có, giữ đủ props, slot, emit của v-*; component chưa có thì viết mới trên Reka UI và token theme, đủ trạng thái và bàn phím theo docs/component-specs.md. Màn Settings > Extensions và Marketplace theo design-system; màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: cùng một bộ extension mẫu (mỗi loại một cái) chạy giống nhau trên Directus và app mới; hook bắn cùng event, endpoint trả cùng response, flow có operation tùy biến cho cùng kết quả; props, slot, emit của từng v-* shim khớp Directus; với BE 3 replica cộng 1 Directus (compose và kind): cài ở một node thì mọi node thấy, gỡ thì mọi node trả 404, hook schedule chạy một lần mỗi lượt, scale lên thì pod mới có extension trước khi ready.
```

Quyết định của owner (2026-10-21): tương thích hoàn toàn với extension app của Directus (phương án A: shim toàn bộ
`v-*`), bỏ loại theme, bật marketplace, bật sandbox, shim theo giao diện TailAdmin (không chép CSS của Directus).

Số đo trước khi viết spec (2026-10-21, đếm bằng regex, chỉ là xấp xỉ):

| Phần extension app dùng                           | Hiện trạng apps/web                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 77 component `v-*`                                | 31 có cặp `Bo*` nhưng thiếu khoảng 160 props (nặng nhất `v-select`, `v-button`, `v-input`, `v-menu`, `v-chip`, `v-checkbox`, `v-table`); khoảng 11 đã port với tên khác (`RenderDisplay`, `RenderTemplate`, các drawer, `FieldList`...); khoảng 35 chưa có (`VList*`, `VCard*`, `VTab*`, `VSkeletonLoader`, `VTemplateInput`, `VEmojiPicker`, `Transition*`...) |
| `PrivateView`, `PublicView`, `SharedView`         | Không có component toàn cục; khung là TailAdmin (D-127, D-128)                                                                                                                                                                                                                                                                                                  |
| 7 directive (`tooltip`, `md`, `click-outside`...) | Không có directive toàn cục                                                                                                                                                                                                                                                                                                                                     |
| `useStores`, `useApi`, `useSdk`, `useExtensions`  | 14 store có đủ; `useApi` trả AxiosInstance nhưng apps/web không có axios (012 chỉ dùng `@directus/sdk`, cần owner duyệt); chưa có `useExtensions`                                                                                                                                                                                                               |
| Biến CSS `--theme--*`                             | Directus styles dùng 39 biến (chưa đếm biến sinh lúc chạy), apps/web có 3                                                                                                                                                                                                                                                                                       |
| Registry interface, display, panel, operation     | Tĩnh (013, 017, 018); cần thêm đường đăng ký lúc chạy                                                                                                                                                                                                                                                                                                           |

Ghi chú đưa vào spec và plan 020:

- Extension API phải chạy ở API mới: pool `api_pool` trong `deploy/compose/lb/shared-domain.conf` có cả Directus và
  Backoffice, và `bo_pool` của chế độ separate-domain chỉ có Backoffice. Nạp ở một phía thì hook, endpoint, operation
  lúc chạy lúc không.
- Nhiều instance: Directus đồng bộ extension từ storage `EXTENSIONS_LOCATION` về đĩa local lúc khởi động
  (`lib/sync/sync.ts`), cài gỡ thì ghi lên storage rồi publish `extensions.reload` (`manager.ts`). Không có
  `EXTENSIONS_LOCATION` thì cài từ marketplace chỉ vào một pod.
- Kết quả plan (2026-10-21, `specs/020-extensions/research.md`): machine-id trong container = sha256(hostname) nên mỗi
  pod tự sync (không có pod đọc đĩa trống), nhưng khóa không có TTL: app mới xóa khóa cũ của máy mình lúc khởi động;
  `directus_extensions` không unique nên N node khởi động cùng lúc chèn trùng: khóa Redis `extensions-settings` (R-58).
  Express 5 cho endpoint và `init` với danh sách D-139 (owner chọn B). Shared dep của bundle qua **import map** trong
  `index.html` (owner chọn D ở plan; C/D-140 của clarify bị bỏ vì manifest hỏng ở domain riêng và cross-site); `pinia`
  ghim 2.3.1. Directus 11.17.4 không có chọn phiên bản, nhãn sandbox, hộp xác nhận ở Extensions/Marketplace (spec đã
  sửa). 173 biến `--theme--*` (không phải 45). Kiểm kê 77 shim: 13 cùng hợp đồng, 30 mở rộng `Bo*`, 34 viết mới.
- Ba lượt lên `main` (clarify): API + nhiều instance (+ Settings > Extensions chỉ đọc, bật tắt) → web shim + nạp bundle
  - module → marketplace cài gỡ.

### 021: Chạy độc lập: khởi tạo DB, migration và CLI

Chạy `/speckit.constitution` ở mục 4 ("Sửa constitution cho 021") trước.

```text
/speckit.specify Backoffice chạy độc lập: tự khởi tạo DB, chạy migration và có CLI giống Directus 11.17.4. Khởi động: image API chạy bootstrap rồi start giống directus/Dockerfile, không hỏi gì. DB trống: chờ DB 5 lần x 5 giây, chạy 15 seed yaml, migrate latest, createAdmin từ ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_TOKEN, ghi PROJECT_NAME, setOwner khi PROJECT_OWNER là email (không gửi report, D-38). DB đã cài: chỉ migrate latest. Không có lock, giống Directus. Vendor: Backoffice tự khởi tạo và migrate với Postgres và SQLite; vendor khác thì DB do Directus khởi tạo và migrate, Backoffice chỉ kiểm tra directus_migrations như hiện nay (ghi thành khác biệt). CLI cho apps/api, port directus/api/src/cli với cùng lệnh, option, log và exit code: start, init, bootstrap [--skipAdminInit], database install, database migrate:latest|up|down, users create|passwd, roles create, cache clear [--system|--data], count <collection>, schema snapshot|apply, security key:generate|secret:generate. Lệnh init chỉ hiện các vendor Backoffice hỗ trợ khởi tạo (Postgres, SQLite) và không chạy npm install driver vì driver đã có trong image (ghi thành khác biệt); dùng DB khác thì khởi tạo bằng Directus. Migration: port nguyên văn directus/api/src/database/migrations/run.ts và 101 file của 11.17.4, cùng custom migration trong MIGRATIONS_PATH; ghim 11.17.4. Tương thích: DB do Backoffice bootstrap thì Directus 11.17.4 khởi động, đăng nhập và migrate được, và ngược lại; validate-migrations.ts vẫn đạt. Deploy chế độ độc lập: compose có service chạy bootstrap một lần rồi mới start các replica API, không có Directus; Helm có Job hook pre-install/pre-upgrade tạo pod riêng chạy bootstrap một lần, Deployment chỉ tạo sau khi Job xong và pod API chỉ chạy start, ConfigMap/Secret mà Job cần phải có trước Job, không cần ConfigMap, Secret hay PVC của Directus; chế độ chạy chung của 019 giữ nguyên. Ngoài phạm vi khi chạy độc lập: gửi email, WebSocket, SAML, storage ngoài Local/S3 và các mục XI khác; liệt kê trong "Khác biệt so với Directus". Test đối chiếu trên Postgres và SQLite: bootstrap DB trống bằng Directus và bằng Backoffice rồi so sánh schema, các hàng hệ thống (bỏ qua uuid, thời gian, hash) và directus_migrations; chạy migrate latest/up/down với bộ custom migration mẫu ở cả hai app; so sánh output và exit code của từng lệnh CLI; acceptance deploy độc lập trên compose và kind (install, rồi upgrade có custom migration mới).
```

Quyết định của owner (2026-10-22): chạy độc lập nhưng DB vẫn dùng được với Directus 11.17.4; port toàn bộ CLI của
Directus; bootstrap không có lock như Directus; Postgres và SQLite do Backoffice khởi tạo, vendor khác do Directus; Helm
dùng Job chạy bootstrap một lần trước khi deploy (không dùng init container); các mục XI vẫn ngoài phạm vi; ghim
11.17.4.

Ghi chú đưa vào spec và plan 021:

- Directus khởi động bằng `node cli.js bootstrap && pm2-runtime start ecosystem.config.cjs` (`directus/Dockerfile`).
  Image Backoffice hiện chỉ chạy `node dist/main.js` (`apps/api/Dockerfile`), và `apps/api` chưa có CLI.
- `bootstrap` (`directus/api/src/cli/commands/bootstrap/index.ts`) không hỏi gì. `init` (`cli/commands/init/index.ts`)
  mới hỏi: vendor, thông tin kết nối, email và mật khẩu admin; rồi chạy `npm install <driver>` và ghi `.env`.
- Đã có sẵn: `apps/api/src/utils/create-admin.ts`, `setOwner` không gửi report (D-38),
  `apps/api/src/database/validate-migrations.ts`, danh sách `migrations/directus-11.17.4.ts`, biến `MIGRATIONS_PATH`.
- Directus `migrate` đọc `MIGRATIONS_PATH` (`run.ts`), còn kiểm tra lúc khởi động đọc `<EXTENSIONS_PATH>/migrations`
  (`database/index.ts`). `migrate:down` báo `Couldn't find migration` nếu migration chạy gần nhất không có file.
- Helm hook `pre-install` chạy trước mọi resource của chart: ConfigMap/Secret mà Job cần phải là hook có weight nhỏ hơn,
  hoặc được tạo sẵn ngoài chart. Init container chạy riêng trong từng pod nên N pod vẫn bootstrap song song; vì vậy
  owner chọn Job.
- Plan phải kiểm tra: 101 migration dùng helper Directus nào mà Backoffice chưa port; `schema snapshot|apply` dùng lại
  SchemaService của 006 được không.
- Chia lượt khi `/speckit.tasks`: (1) bootstrap, database install, migrate; (2) các lệnh CLI còn lại; (3) deploy độc
  lập.

### 022: Ẩn hiện ô tìm kiếm, Import, Export theo collection, migration riêng

Trạng thái 2026-10-26: đã xong. Ba lượt trên `main` (`a948e3f0`..`173403ae`), 46/46 task, CI 40308977164 xanh,
parity-matrix 40320127600 và benchmark-web 40320123598 xanh; D-179..D-182 đã duyệt (D-182: tiêu đề card ba toggle chỉ
ở web). Chủ dự án 2026-10-26: MySQL tạm bỏ khỏi CI rồi bật lại cùng ngày. Kết quả từng lượt ở `research.md` "Kết quả lượt
1/2/3".

**Thứ tự chạy:**

| Bước | Lệnh                                     | Model (mục 8)          | Ghi chú                                                                      |
| ---- | ---------------------------------------- | ---------------------- | ---------------------------------------------------------------------------- |
| 1    | `/speckit.specify` (prompt dưới)         | Opus 5.5, effort high  | Đã chạy 2026-10-26. Chạy lại chỉ khi muốn viết lại spec từ đầu.              |
| 2    | `/speckit.constitution` (mục 4, cho 022) | Opus 5.5, effort high  | Đã chạy 2026-10-26 (3.2.0). D-179, D-180, D-181 duyệt 2026-10-26.            |
| 3    | `/speckit.clarify`                       | Opus 5.5, effort high  | Bỏ qua được: 10 câu đã chốt ngày 2026-10-26.                                 |
| 4    | `/speckit.plan` (prompt dưới)            | Opus 5.5, effort xhigh | Ra `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`. |
| 5    | `/speckit.checklist`                     | Sonnet 5.5             | Tùy chọn.                                                                    |
| 6    | `/speckit.tasks`                         | Sonnet 5.5             | Chia ba lượt (dưới).                                                         |
| 7    | `/speckit.analyze`                       | Opus 5.5, effort high  | Sửa chỗ spec, plan, tasks lệch nhau trước khi code.                          |
| 8    | `/speckit.implement`                     | Opus 5.5, effort high  | Mỗi lượt: test xanh, `graphify update .`, commit lên `main`, xem CI.         |

**Lưu ý chung:**

- Làm trên `main`, không tạo branch: `create-new-feature.sh` chạy `git checkout -b`, sẽ đổi branch của các session khác
  dùng chung checkout. Trên `main`, script của Spec Kit báo "Not on a feature branch" trừ khi đặt
  `SPECIFY_FEATURE=022-collection-ui-toggles` (`.specify/scripts/bash/common.sh`; quy tắc "thư mục số cao nhất" chỉ dùng
  khi không có git). Thêm câu "Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify." vào đầu prompt
  của mỗi lệnh `/speckit.*`.
- Không stage `apps/api/project.json`, `apps/web/project.json` (thay đổi của session khác).

**Prompt `/speckit.specify`:**

```text
/speckit.specify Ẩn hiện ô tìm kiếm, Import, Export theo từng collection trong module Content của Backoffice, kèm bộ migration riêng của Backoffice. Dữ liệu: thêm ba cột vào directus_collections: bo_show_search, bo_show_import, bo_show_export, boolean, mặc định true, cho phép null; null hoặc chưa có cột thì hiểu là hiện (như hiện nay). Admin sửa ba cài đặt trong form collection của Settings > Data Model; nhãn en-US, vi-VN lấy từ ba dòng directus_fields (interface boolean, width half), nên Backoffice và Directus app cùng hiện ba toggle. Cài đặt áp dụng cho mọi người dùng, kể cả admin. Ô tìm kiếm: khi bo_show_search tắt, trang /content/:collection chỉ ẩn ô nhập từ khóa, giữ nút bộ lọc (cùng popover, cùng badge số bộ lọc); không gửi từ khóa lấy từ preset, bookmark hay URL; preset giữ nguyên; bộ lọc vẫn áp dụng. Import, Export: khi bo_show_import tắt, mục Import/Export của detail panel không có phần import (chọn file, chạy nền, nút Import); khi bo_show_export tắt, không có nút Export và link tải CSV của trang hiện tại; cả hai tắt thì không có mục. Chỉ là giao diện: API search, export, /utils/import, /utils/export không đổi, quyền vẫn do permission. Phạm vi: chỉ trang collection của Content; DrawerCollection, module khác và Directus app không đổi. Migration riêng: thư mục riêng apps/api/src/database/backoffice-migrations (không chung 101 migration port từ Directus), trạng thái trong bảng hệ thống backoffice_migrations cùng dạng directus_migrations; không ghi directus_migrations. bootstrap tạo bảng nếu chưa có rồi chạy migration riêng còn thiếu, trên mọi vendor, sau khi migration Directus đã đủ, dưới lock dùng chung (Redis khi có cấu hình) để nhiều replica khởi động cùng lúc chỉ một process chạy; migration Directus chưa đủ thì không chạy. Mỗi migration chỉ có up, chỉ dùng knex, chạy được trên 7 vendor, chạy lại được; không có down, không có lệnh CLI riêng. Lúc start, migration riêng thiếu hoặc lạ thì dừng và báo rõ. Backoffice coi backoffice_migrations là collection hệ thống như directus_migrations (danh sách collection hệ thống của API, ẩn, không truy cập qua /items, nhóm hệ thống ở Data Model, không vào snapshot). Migration đầu tiên 20261026A thêm ba cột và ba dòng directus_fields. Chạy song song: Directus 11.17.4 trên cùng DB không cần file, biến môi trường hay cấu hình mới; khởi động, đăng nhập, đọc ghi collection, snapshot/diff/apply, migrate:latest|up|down như trước; GET /collections và GET /fields/directus_collections của hai app giống nhau trừ backoffice_migrations (Directus trả meta null); Directus thấy ba cột (ba toggle không có tác dụng ở Content của Directus app) và bảng backoffice_migrations trong danh sách bảng chưa quản lý. Ghi thành khác biệt D-179 (giao diện Content), D-180 (migration riêng), D-181 (backoffice_migrations là collection hệ thống). Test: unit cho ẩn hiện và bộ chạy migration; E2E Content ba cấu hình với admin và user thường; profile bootstrap chạy migration, chạy lại, ba replica cùng lúc, so dump với Directus bỏ qua backoffice_migrations, cột bo_* và dòng directus_fields của chúng; bộ đối chiếu, blackbox collections/fields/schema trên DB đã migrate; vendor khác chạy hằng đêm.
```

**Prompt `/speckit.plan`:** dán phần chung BE và FE ở mục 7, rồi thêm:

```text
Feature 022 có cả BE và FE. BE: bộ chạy migration riêng là file mới apps/api/src/database/backoffice-migrations/index.ts (danh sách import tĩnh, không readdir) và run.ts (chỉ latest trên backoffice_migrations, tạo bảng nếu chưa có, chạy trong useLock().usingLock('backoffice-migrations', ...) của apps/api/src/lock (redlock khi có Redis, local khi không), đọc lại bảng sau khi lấy lock, flushCaches(true) sau khi chạy như run.ts của Directus); không sửa migrations/run.ts và 101 file port (port.test.ts giữ nguyên); không thêm lệnh CLI. Nối vào cli/commands/bootstrap/index.ts (cuối nhánh Postgres/SQLite, và nhánh vendor D-145 khi migrationsValid), database/validate-migrations.ts (kiểm tra thêm backoffice_migrations: thiếu hoặc lạ thì dừng). backoffice_migrations là collection hệ thống: thêm vào libs/system-data/src/collections/collections.yaml (hidden) và sửa isSystemCollection của libs/system-data (đang chỉ nhận tiền tố directus_) và của apps/web/src/stores/collections.ts. Migration 20261026A: hasColumn trước khi thêm cột, kiểm tra dòng directus_fields trước khi insert. FE: prop showSearch cho components/SearchInput.vue (giống showFilter: ẩn nút search, input, nút xóa; pill w-11; activate không mở khi tắt); prop showImport, showExport cho components/sidebar/ExportSidebarDetail.vue (phần import đang ở v-if="createAllowed", phần export gồm nút Export và link CSV); modules/content/routes/CollectionRoute.vue đọc meta.bo_show_search, meta.bo_show_import, meta.bo_show_export (!== false), activeSearch thay search cho layout wrapper và ExportSidebarDetail, v-if="showImport || showExport" cho ExportSidebarDetail. Test: dump của profile bootstrap (tests/parity/src/bootstrap) và cli.test.ts bỏ qua phần của Backoffice; bộ đối chiếu collections bỏ qua backoffice_migrations; test migration chạy trên SQLite in-memory.
```

Quyết định của owner (2026-10-26):

| Câu hỏi                              | Chốt                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Tạo cột bằng cách nào                | Migration riêng của Backoffice (không tạo qua API fields)                                |
| Bảng theo dõi migration              | `backoffice_migrations` riêng: nhiều migration về sau, không đụng Directus cũ            |
| Tắt ô tìm kiếm thì ẩn gì             | Chỉ ô nhập từ khóa, giữ nút bộ lọc                                                       |
| Admin có bị ẩn không                 | Có, ẩn với mọi người                                                                     |
| Import và Export                     | Hai cài đặt riêng: `bo_show_import`, `bo_show_export`                                    |
| Tắt Export thì link CSV của trang    | Ẩn theo                                                                                  |
| DrawerCollection                     | Không theo cài đặt, chỉ trang Content                                                    |
| Nhiều replica khởi động cùng lúc     | Lock qua Redis                                                                           |
| Lệnh CLI cho migration riêng         | Không có, chỉ chạy trong `bootstrap`; không có down                                      |
| `backoffice_migrations` ở Data Model | Backoffice coi là bảng hệ thống như `directus_*` (D-181); Directus vẫn thấy chưa quản lý |

Ghi chú đưa vào spec và plan 022 (đọc code ngày 2026-10-26, chưa chạy thử):

- Directus nạp schema chỉ đọc 5 cột của `directus_collections` (`directus/api/src/utils/get-schema.ts:129-131`), nên cột
  thêm không ảnh hưởng schema cache. `GET /collections` đọc bảng qua ItemsService không giới hạn field
  (`services/collections.ts:319-329`), nên `meta` có ba khóa mới; quyền app-access đọc với `fields: ['*']`.
- Lý do không ghi `directus_migrations`: `migrate:down` của Directus báo `Couldn't find migration` khi dòng chạy cuối
  không có file (`database/migrations/run.ts:97-106`); `migrate:up` một bước có thể bỏ qua migration Directus có version
  nhỏ hơn (`run.ts:61-72`).
- Bảng không có dòng `directus_collections`: API trả về với `meta: null` (`services/collections.ts:382-391`), Data Model
  của Directus app liệt kê (`app/src/modules/settings/routes/data-model/collections/collections.vue:108`), snapshot bỏ
  qua (`utils/get-snapshot.ts:71-74`). Backoffice coi `backoffice_migrations` là collection hệ thống (D-181), nên
  `GET /collections` của hai app khác nhau ở dòng này.
- Lock: `useLock()` (`apps/api/src/lock/lib/use-lock.ts`) có `usingLock`; bản Redis dùng redlock thử 100 lần cách 50 ms
  (`libs/memory/src/kv/lib/redis.ts:72-74`), nên replica chờ quá khoảng 5 giây sẽ lỗi và container khởi động lại
  [Inference].
- `isSystemCollection` của `libs/system-data` và `apps/web/src/stores/collections.ts` hiện chỉ nhận tiền tố `directus_`.
- Image Backoffice chạy `node cli.js bootstrap && exec node cli.js start` (`apps/api/Dockerfile:75`); nhánh vendor ngoài
  Postgres, SQLite của `bootstrap` thoát sớm (`apps/api/src/cli/commands/bootstrap/index.ts:29-42`).
- `SearchInput.vue` đã có prop `showFilter`; `CollectionRoute.vue` dùng `SearchInput` (khoảng dòng 409) và
  `ExportSidebarDetail` (khoảng dòng 552, phần import trong `v-if="createAllowed"`, phần export gồm nút Export và link
  CSV).
- Chia lượt khi `/speckit.tasks`: (1) BE: bộ chạy migration có lock, migration 20261026A, bootstrap, kiểm tra lúc start,
  `backoffice_migrations` là collection hệ thống, test SQLite, cập nhật profile `bootstrap`; (2) FE: `SearchInput`,
  `ExportSidebarDetail`, `CollectionRoute`, `isSystemCollection` của web, unit và E2E Content; (3) đối chiếu
  collections/fields/schema trên DB đã migrate, vendor khác hằng đêm.

---

## 7. Prompt `/speckit.plan`

Dùng phần chung dưới đây cho mọi feature, rồi thêm 1–2 câu riêng cho feature đó.

**BE (001–011):**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. <thêm phần riêng của feature>
```

**FE (012–018):**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. <thêm phần riêng của feature>
```

---

## 8. Chọn model cho từng bước

Đổi model trong Claude Code bằng `/model opus`, `/model sonnet`, `/model haiku`. Đổi mức suy nghĩ bằng `/effort`.

**Các model dùng trong dự án** (giá API theo 1 triệu token, tham khảo để so sánh chi phí):

| Model          | Đặc điểm                                                                          | Context | Giá vào / ra |
| -------------- | --------------------------------------------------------------------------------- | ------- | ------------ |
| **Opus 5.5**   | Mạnh nhất trong các model dùng được, model mặc định. Tăng `/effort` khi việc khó. | 1M      | $4 / $20     |
| **Sonnet 5.5** | Nhanh, đủ tốt cho code thường ngày.                                               | 1M      | $2 / $10     |
| **Haiku 4.5**  | Rẻ và nhanh nhất, cho việc đơn giản.                                              | 200K    | $1 / $5      |

Fable 5.1 không dùng được với tài khoản hiện tại. Thay vào đó, dùng Opus 5.5 với effort cao (`xhigh` hoặc `max`) cho các
bước khó.

**Nguyên tắc:** lỗi ở bước đầu (spec, plan) lan sang mọi bước sau, nên đầu tư effort cao ở đầu quy trình. Bước làm theo
khuôn có sẵn thì dùng model rẻ hơn.

**Feature lõi** là những feature khó giữ tương thích với Directus nhất: **002, 003, 004, 005, 006, 009, 011** (BE) và
**013, 014** (FE), và **020** (cả hai).

| Bước                    | Feature lõi                                                                                                                                | Feature còn lại                                                                | Lý do                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `/speckit.constitution` | Opus 5.5, effort high                                                                                                                      | –                                                                              | Chạy một lần. Prompt đã viết sẵn chi tiết, chỉ cần soạn lại cho đúng template. |
| `/speckit.specify`      | Opus 5.5, effort high                                                                                                                      | Opus 5.5, effort high                                                          | Phải đọc code tham chiếu trong `directus/` để viết đúng hành vi.               |
| `/speckit.clarify`      | **Opus 5.5, effort xhigh**                                                                                                                 | Opus 5.5, effort high                                                          | Tìm chỗ mơ hồ cần suy luận sâu về luồng của Directus.                          |
| `/speckit.plan`         | **Opus 5.5, effort max**                                                                                                                   | Opus 5.5, effort xhigh                                                         | Bước quan trọng nhất: quyết định cách port, giữ tương thích DB, cache, token.  |
| `/speckit.checklist`    | Sonnet 5.5                                                                                                                                 | Sonnet 5.5                                                                     | Làm theo khuôn có sẵn.                                                         |
| `/speckit.tasks`        | Opus 5.5, effort high                                                                                                                      | Sonnet 5.5                                                                     | Feature lõi có nhiều phụ thuộc, cần sắp thứ tự cẩn thận.                       |
| `/speckit.analyze`      | **Opus 5.5, effort xhigh**                                                                                                                 | Opus 5.5, effort high                                                          | Bắt chỗ spec, plan, tasks không khớp nhau trước khi code.                      |
| `/speckit.implement`    | **Opus 5.5, effort xhigh**. Tăng lên max cho phần port logic phức tạp (apply-query, run-ast, payload, permissions, flows, GraphQL schema). | Opus 5.5, effort high. Sonnet 5.5 cho component FE, boilerplate, test lặp lại. | Đọc nhiều code gốc và phải giữ hành vi giống hệt.                              |
| Sửa lỗi test đối chiếu  | Opus 5.5, effort xhigh, tăng lên max nếu sửa 2 lần chưa được                                                                               | Opus 5.5, effort high                                                          | So khác biệt với Directus cần đọc kỹ cả hai bên.                               |
| `/speckit.status`       | Haiku 4.5                                                                                                                                  | Haiku 4.5                                                                      | Chỉ đọc trạng thái.                                                            |

**Khi Opus 5.5 effort max vẫn chưa làm tốt** (thường gặp ở 005 và 009):

- Tách feature thành các phần nhỏ hơn. Ví dụ 009 tách thành "trigger và engine" và "các operation" (004 đã port engine
  đọc ghi trong hai lượt).
- Trong prompt, chỉ thẳng file Directus cần đọc, thay vì để model tự tìm.
- Cho model chạy test đối chiếu sau mỗi task thay vì cuối feature, để lỗi được phát hiện sớm.

**Lưu ý:**

- **Không dùng `/speckit.quick` cho dự án này.** Lệnh này gộp nhiều bước, nên bỏ qua các điểm kiểm tra mà feature cần
  giữ tương thích phải có.
- **Không dùng Haiku 4.5 cho bước nào phải đọc code Directus.** Context 200K không đủ cho các module lớn.
- **Đổi model giữa các bước thì nên mở session mới,** hoặc ít nhất chạy `/clear`, để model mới đọc lại spec và plan từ
  file thay vì dựa vào hội thoại cũ.
- Effort càng cao thì mỗi lượt càng lâu và tốn token hơn. Dùng `max` cho các ô in đậm, không đặt mặc định cho mọi việc.

---

## 9. Mẹo khi chạy

- **Chạy `/speckit.clarify` cho feature 003, 004, 005, 009.** Đây là những phần dễ hiểu sai nhất.
- **Feature FE (013–018) dùng lại design-system đã chốt** (TailAdmin, constitution XII từ 2.0.0): theme
  `brand-*`/`gray-*`, công thức component trong `design-system/docs/component-specs.md`, khung app trong
  `docs/layout-patterns.md` (sidebar, header, page header, panel chi tiết đã dựng ở 012). Chạy `/speckit.clarify` khi
  màn hình cần dựng chưa có mẫu trong design-system (bảng dữ liệu lớn, form theo metadata, trình kéo thả flow...).
- **Chạy `/speckit.analyze` trước `/speckit.implement`** để bắt lỗi spec, plan, tasks không khớp nhau.
- **Feature lớn (004, 013, 014) nên chia lượt** nếu tasks.md quá dài (trên khoảng 60 task), như 004 chia hai lượt
  implement, mỗi lượt commit và đối chiếu xanh.
- **Theo dõi tiến độ:** `/speckit.status` cho biết feature hiện tại đang ở bước nào.
- **Mỗi feature làm xong** thì chạy test đối chiếu, rồi merge branch trước khi sang feature sau.

---

## 10. Rủi ro cần lưu ý

| Rủi ro                 | Ghi chú                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|                        |
| Lệch phiên bản         | Khi nâng Directus lên bản mới, app mới phải cập nhật theo, vì DB dùng chung. Khóa Directus ở 11.17.4 cho đến khi app mới hỗ trợ bản tiếp theo.                                                                                                     |
| Cache và bus           | Sai một cache key hay tên kênh là hai app hiển thị dữ liệu cũ. Feature 002 phải test kỹ hai chiều.                                                                                                                                                 |
| Realtime trên Directus | App mới không có WebSocket. Nếu Directus vẫn bật `WEBSOCKETS_ENABLED=true`, người dùng Directus app vẫn có collaborative editing, nhưng không thấy người đang sửa cùng item bằng app mới. Muốn hai bên giống nhau thì tắt WebSocket trên Directus. |
| Storage local          | Nếu một môi trường vẫn để `STORAGE_LOCAL_*` trỏ vào ổ riêng của container, file tải lên ở replica này sẽ không thấy ở replica khác. Kiểm tra cấu hình storage trước khi tăng số replica.                                                           |
| Khối lượng             | Có khoảng 737 file TS ở BE và 551 file Vue ở FE. Ước lượng theo từng feature sau bước `/speckit.tasks`.                                                                                                                                            |
| Design-system          | TailAdmin bản miễn phí không có màn CMS; các màn (layout table/cards/calendar/kanban/map, form theo metadata, flow editor, dashboard) phải tự thiết kế trên theme và ghi vào `design-system/docs/` trước khi code để các feature sau dùng lại.     |

## 11. Hoãn tới khi xong mọi spec

Owner quyết định 2026-10-16 (chuyển qua phiên 014): không làm trong các lượt của 015 hay feature nào, chỉ làm sau khi
mọi spec (đến 019) đã xong.

- **p95 benchmark API chậm hơn Directus 11.17.4**: điều tra rồi sửa trong `apps/api`, hoặc ghi thành khác biệt được tech
  lead duyệt. Số đo của run 38752626188 (2026-10-15) so với run hằng tuần 39167500790 (2026-10-18, commit 12b7246):

  | Job                 | Request                                          | 2026-10-15 Bo / Directus | 2026-10-18 Bo / Directus | Kết quả 2026-10-18       |
  | ------------------- | ------------------------------------------------ | ------------------------ | ------------------------ | ------------------------ |
  | `benchmark`         | GET /server/specs/oas                            | 279.6 / 249.3 ms         | 211.3 / 251.4 ms         | đạt                      |
  | `benchmark-system`  | GET presets-list, user, 50 kết nối               | 639.5 / 559.1 ms         | 873.0 / 722.9 ms         | đỏ (fail, ok, fail)      |
  | `benchmark-history` | POST version-save, admin, 10 kết nối             | 206.0 / 174.0 ms         | 63.2 / 64.1 ms           | đạt                      |
  | `benchmark-files`   | POST files-upload, admin, 50 kết nối             | 472.3 / 346.9 ms         | 376.1 / 384.8 ms         | đạt                      |
  | `benchmark-schema`  | GET /fields, admin, cached                       | 792.1 / 788.0 ms (đạt)   | 790.0 / 704.5 ms         | đỏ (fail, fail)          |
  | `benchmark-web`     | files: next page (web → Directus / Directus app) | 112 / 108 ms (đạt)       | 107 / 81 ms              | đỏ (web → API 88 ms đạt) |

  Điều tra 2026-10-19 (env benchmark ở máy local, hai app chạy kiểu amd64 giả lập, cùng tải):
  - presets-list ở tốc độ cố định: Bo 861 ms, Directus 813 ms (6 %, đạt). Ở tải tối đa, Bo nhanh hơn: trung bình 822 ms
    so với 849 ms, p99 999 ms so với 1433 ms, 59,5 so với 57,6 req/s.
  - `/fields` admin cached ở 67 req/s (80 % của Directus): p97.5 của Bo 566–567 ms, của Directus 586–626 ms.
  - Profile `--cpu-prof` của hai container dưới cùng tải presets-list: cùng lượng CPU (33,3 s so với 33,6 s, GC 2,08 s
    so với 2,19 s). Các hàm nóng giống nhau: `cloneDeep` schema ở mỗi request (`CACHE_SCHEMA_FREEZE_ENABLED=false` như
    Directus), nén JSON khi `respond` ghi cache response, `removeTemporaryFields`. Không có điểm nóng riêng của Bo.
  - [Inference] Chênh lệch trên runner GitHub là do biến động của runner, không phải code; trên CI, req/s của Bo luôn
    cao hơn Directus. Chưa có số đo CI nào sau lần điều tra này.
  - `benchmark-web`: với 11 lần chạy, p95 là lần chậm nhất, nên một lần giật làm đỏ một bước khoảng 100 ms (mốc Directus
    app là 108 ms lần trước, 81 ms lần này). `web-files-users.ts` giờ đo lại bước bị đỏ và lấy đa số 2/3, như
    `confirmed()` của benchmark API. Run 39286312657 vẫn đỏ ở "files: next page", lần này ở web → API (134 / 119 ms, cả
    hai lần đo), với cùng request. Owner chọn (2026-10-20): một bước chỉ tính là chậm khi vượt cả 10 % lẫn 25 ms
    (`WEB_FLOOR_MS`, `webSlower()` của `compare.ts`, dùng cho `web-content.ts` và `web-files-users.ts`).
  - Chạy lại 2026-10-19: presets-list đạt (Bo 635,9 / Directus 682,5 ms, run 39286285717).
  - Chạy lại `benchmark-web` 2026-10-20 trên 7fb8faf: đạt (run 39417286435). "files: next page" 126 / 112 ms (web →
    Directus / web → API) so với Directus app 113 ms. Điều tra ở máy cùng ngày (10 000 file, CPU chậm 2–4 lần): tổng
    thời gian hai bên ngang nhau; Bo gửi request sớm hơn rồi render 25 card sau, Directus làm phần lớn việc trước khi
    gửi; profile JS gần bằng nhau, không có điểm nóng riêng của Bo. Không sửa code.

  Chạy lại một job: `gh workflow run benchmark.yml -f job=<job>`.

- **Parity GraphQL chập chờn**: đã sửa ở e23595c (2026-10-18). `schema.test.ts` (profile `graphql-nointro`): hai app
  nhận cùng truy vấn một lúc và đọc cache của nhau (`x-cache-status` HIT so với MISS); `capture()` giờ gửi
  `Cache-Control: no-store` cho POST /graphql. `system.test.ts` trên MySQL: `INFORMATION_SCHEMA.COLUMNS` không có ORDER
  BY (như Directus), nên `fields_in_collection` được so theo tên field. Các run 39107695073 và 39112828931 xanh.
