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
- BE chạy được nhiều container cùng lúc sau load balancer, ngang hàng với các instance Directus trên cùng DB và Redis. Không cần sticky session.
- Khi chạy nhiều instance, Redis là bắt buộc cho cache, bus, rate limiter, lock flow theo lịch và lock upload TUS. Không dùng cache hay lock trong bộ nhớ process làm nguồn dữ liệu duy nhất. Cache trong process chỉ được phép khi được dựng lại từ DB hoặc Redis và bị xóa qua bus Redis trên mọi instance, như Directus.
- File và ảnh đã transform lưu trên storage dùng chung (S3, GCS, Azure hoặc volume dùng chung). Không dùng storage local riêng từng container.
- Khi chạy nhiều instance, extension nạp từ storage dùng chung (EXTENSIONS_LOCATION) hoặc đóng sẵn vào mọi image; cài, gỡ, bật tắt reload mọi instance (cả Directus) qua bus Redis như Directus.
- Khởi động nhiều replica cùng lúc phải an toàn: chỉ đọc và kiểm tra migration, không ghi gì vào bảng hệ thống khi khởi động (ngoại lệ: dòng `directus_extensions` cho extension mới thấy lần đầu, như Directus, có khóa Redis, constitution 2.2.0; lệnh bootstrap, constitution 3.0.0: image chạy bootstrap rồi start như Directus; chế độ chung thì mỗi replica như một container Directus; chế độ độc lập nhiều replica thì bootstrap chạy một lần trong Helm Job pre-install/pre-upgrade hoặc service chạy một lần của compose; không có lock như Directus).
- Có /server/health cho readiness và liveness probe. Khi nhận SIGTERM, ngừng nhận request mới, chạy nốt request đang dở, đóng kết nối DB và Redis rồi mới thoát.
- Khi chạy cạnh Directus, Backoffice ở domain riêng: Directus giữ domain, /admin, Ingress, Deployment của nó và không vào pool API của Backoffice; pool API của Backoffice chỉ gồm replica BE (constitution 3.3.0, feature 026).
- FE và BE của Backoffice nên đặt chung domain của Backoffice: /admin/* vào FE, các path API còn lại vào BE, giống bố cục của Directus.

VIII. Kế thừa toàn bộ biến môi trường của Directus
- BE đọc toàn bộ biến môi trường Directus 11.17.4 hỗ trợ (danh sách và giá trị mặc định trong directus/packages/env/src/constants/defaults.ts và directus-variables.ts), kể cả biến động như DB_*, STORAGE_<LOCATION>_*, AUTH_<PROVIDER>_*, EMAIL_*, CACHE_*, REDIS_*.
- Giữ nguyên tên biến, giá trị mặc định và cách đọc: tiền tố ép kiểu (string:, number:, regex:, array:, json:, boolean:), hậu tố _FILE để đọc secret từ file, CONFIG_PATH với file .env, .json, .yaml, .js.
- Không đổi tên biến khi đổi thương hiệu, không tạo biến mới thay thế biến đã có. Biến chỉ app mới cần thì dùng tiền tố BACKOFFICE_ và phải có giá trị mặc định an toàn.
- Biến Directus mà app mới chưa hỗ trợ: ghi cảnh báo khi khởi động, không dừng app.
- Khi deploy, cùng một file .env, ConfigMap, Secret đang dùng cho Directus phải chạy được ngay cho BE mới mà không cần khai báo lại. FE nhận cấu hình lúc chạy từ chính các biến này (ví dụ PUBLIC_URL). Ngoại lệ duy nhất khi chạy cạnh Directus: bản Backoffice đặt riêng PUBLIC_URL theo domain của nó (constitution 3.3.0).

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

### Sửa constitution theo feature

Feature 021 (2.2.0 → 3.0.0), 022 (3.1.0 → 3.2.0) và 026 (3.2.0 → 3.3.0) đã sửa constitution. Prompt sửa nằm ở bước 0 của feature đó trong
mục 6.

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
| 023 | Filter theo path trong field json (Content, /items, /graphql)                                                   | 005, 011, 014 | BE, FE |
| 024 | API chặn tìm kiếm, Import, Export theo cài đặt collection (mở rộng 022)                                         | 022       | BE, FE |
| 025 | Quyền Import, Export theo policy (bảng backoffice_permissions), bỏ Share khỏi giao diện                         | 016, 024  | BE, FE |
| 026 | Backoffice chạy cạnh Directus chỉ ở domain riêng (bỏ chế độ chung domain của 019)                               | 019, 020, 025 | Deploy |

**Mẹo:** API mới giống hệt Directus, nên FE (012–018) có thể bắt đầu ngay, trỏ vào Directus thật. Khi BE xong thì đổi
URL sang NestJS. Hai mảng chạy song song được.

---

## 6. Lệnh Spec Kit cho từng feature

Mỗi feature có đủ lệnh theo thứ tự ở mục 2. Dán từng khối vào Claude Code theo số bước, mỗi bước chạy xong mới sang bước
sau. Model và effort của từng bước xem mục 8 (cột ghi ở dòng "Trạng thái" của feature).

- **Bước 0** chỉ có ở feature phải sửa constitution (021, 022, 026).
- **`/speckit.plan`** đã gồm phần chung ở mục 7 và phần riêng của feature. Sửa phần chung thì sửa ở mục 7 rồi chép lại
  vào các khối plan.
- **Feature 001–011** làm trên branch do Spec Kit tạo, xong thì merge vào `main`. **Từ 012** làm trên `main`, không tạo
  branch: `create-new-feature.sh` chạy `git checkout -b`, sẽ đổi branch của các session dùng chung checkout. Mỗi khối
  lệnh đã có sẵn câu đặt `SPECIFY_FEATURE` (`.specify/scripts/bash/common.sh`).
- **Feature đã xong**: khối `/speckit.specify` là prompt đã chạy (thêm câu `SPECIFY_FEATURE` từ 012). Các khối còn lại
  soạn lại từ kết quả trong `specs/<feature>/` (tasks.md, checklists/) và CLAUDE.md, để tham khảo hoặc chạy lại; không
  phải nguyên văn lệnh đã chạy.

### 001: Nền tảng workspace và kết nối hệ thống

Trạng thái: Đã xong. Thư mục: `specs/001-platform-foundation/`. Làm trên: branch `001-platform-foundation` do Spec Kit tạo. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Nền tảng cho app mới clone Directus 11.17.4. Cần có monorepo chứa app API, app web và các thư viện dùng chung. API đọc toàn bộ biến môi trường của Directus với cùng tên, cùng giá trị mặc định, cùng tiền tố ép kiểu (string:, number:, regex:, array:, json:, boolean:), hậu tố _FILE và CONFIG_PATH (file .env, .json, .yaml, .js), biến chưa hỗ trợ thì chỉ cảnh báo (tham chiếu directus/packages/env). Một file .env đang chạy được cho Directus phải chạy được ngay cho API mới. kết nối được tới mọi loại DB mà Directus hỗ trợ (Postgres, MySQL/MariaDB, SQLite, MSSQL, Oracle, CockroachDB) và tới Redis. Khi khởi động, API đọc bảng directus_migrations và so với danh sách migration của Directus 11.17.4. Nếu thiếu hoặc thừa migration, API dừng và báo rõ migration nào lệch. API không bao giờ tạo hay sửa bảng directus_*. Có các endpoint /server/ping, /server/health, /server/info, /server/specs/oas trả về giống Directus. Lỗi trả về đúng format errors[] và mã lỗi của Directus (tham chiếu packages/errors). Log JSON giống Directus (LOG_LEVEL, LOG_STYLE, có request id) và endpoint /metrics Prometheus theo METRICS_*. Có bộ test đối chiếu: cùng request gửi tới Directus thật và app mới, rồi so sánh kết quả. Có pipeline GitHub Actions chạy lint, typecheck, unit test kèm ngưỡng coverage, test đối chiếu (Postgres đủ, MySQL và SQLite rút gọn), quét bảo mật và benchmark so với Directus. Tên hiển thị, log, header X-Powered-By và package nội bộ dùng tên Backoffice. Tiêu chí chấp nhận: chạy app mới bằng đúng file .env của Directus, cạnh Directus trên cùng DB và Redis; các endpoint /server/* trả về giống nhau, ngoại trừ các khác biệt do đổi thương hiệu đã liệt kê; DB không bị thay đổi.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: biến môi trường chưa hỗ trợ, kiểm tra directus_migrations lúc khởi động, khác biệt do đổi thương hiệu ở /server/*.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 001: tạo Nx workspace (Nx 23, TypeScript 5.9.3 theo strict flags của @directus/tsconfig 4.0.0, ESM); apps/api là NestJS 12 (Express 5) + Knex 3.1, ioredis, pino, prom-client; port directus/packages/env, errors, schema, storage thành @backoffice/*; endpoint /server/*; test Vitest 3.2.4, Playwright, benchmark autocannon; DB dùng chung chỉ đọc.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist parity-safety-config: kiểm yêu cầu đối chiếu, an toàn khi chạy chung DB, cấu hình env
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 001-platform-foundation vào main.
```

### 002: Schema overview và cache dùng chung

Trạng thái: Đã xong. Thư mục: `specs/002-schema-overview-cache/`. Làm trên: branch `002-schema-overview-cache` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify API cần dựng được bức tranh schema (collections, fields, relations, kiểu dữ liệu, khóa chính, alias field) từ DB và các bảng directus_collections, directus_fields, directus_relations, giống hệt SchemaOverview của Directus (tham chiếu directus/api/src/utils/get-schema.ts và packages/schema). Schema được cache trong Redis với cùng cache key và namespace như Directus. Khi Directus hoặc app mới đổi schema, instance còn lại nhận tín hiệu qua cùng kênh bus của Directus và xóa cache. Hỗ trợ CACHE_SCHEMA, CACHE_NAMESPACE, CACHE_STORE và các biến cache khác giống Directus. Tiêu chí chấp nhận: thêm field ở Directus thì app mới thấy field đó ngay mà không cần khởi động lại, và ngược lại.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: cache key, namespace và kênh bus dùng chung với Directus; khi nào cache bị xóa ở cả hai app.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 002: port @directus/memory thành @backoffice/memory (bus Redis, kv, cache nhiều tầng; lru-cache 11.2.2, @sesamecare-oss/redlock 1.4.0); cache SchemaOverview trong process, dùng chung lock và bus Redis với Directus; tham chiếu directus/api/src/utils/get-schema.ts, packages/schema, packages/memory.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist requirements: kiểm yêu cầu cache schema dùng chung
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 002-schema-overview-cache vào main.
```

### 003: Xác thực và phiên đăng nhập

Trạng thái: Đã xong. Thư mục: `specs/003-auth-session/`. Làm trên: branch `003-auth-session` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify Người dùng đăng nhập vào app mới bằng email và mật khẩu đã có trong directus_users, nhận access token và refresh token giống hệt Directus (cùng SECRET, cùng payload JWT, cùng TTL ACCESS_TOKEN_TTL và REFRESH_TOKEN_TTL). Hỗ trợ ba chế độ json, cookie, session như Directus, với cùng tên cookie. Session lưu trong directus_sessions. Token cấp ở Directus dùng được ở app mới và ngược lại. Hỗ trợ: /auth/login, /auth/refresh, /auth/logout, /auth/password/request, /auth/password/reset, static token của user, xác thực hai lớp (TFA, /users/me/tfa/*), kiểm tra trạng thái user (active, suspended, invited), giới hạn đăng nhập sai (LOGIN_STALL_TIME, rate limiter dùng chung Redis). Đăng nhập SSO chỉ hỗ trợ OpenID Connect (Azure AD/Entra ID, Keycloak...) theo các biến AUTH_* giống Directus. Provider cấu hình driver ldap, oauth2 hoặc saml thì bị bỏ qua và ghi cảnh báo khi khởi động. /auth/password/request trả về giống Directus nhưng không gửi email, chỉ ghi log. Tham chiếu directus/api/src/auth, services/authentication.ts, controllers/auth.ts. Tiêu chí chấp nhận: bộ test blackbox auth của Directus chạy qua trên app mới, và token dùng chéo được giữa hai bên.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: token dùng chéo, chế độ json/cookie/session, TFA, rate limiter dùng chung Redis, provider SSO chưa hỗ trợ.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 003: jsonwebtoken 9.0.3, argon2 0.44.0, otplib 12.0.1, openid-client 5.7.1, ldapts 8.1.3, joi, flat 6.0.1 cùng bản Directus; port @directus/validation thành @backoffice/validation; ghi directus_sessions, activity, revisions; dùng chung SECRET, session và bộ đếm đăng nhập sai trên Redis với Directus.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist auth-review: kiểm yêu cầu token dùng chéo, cookie, TFA, rate limiter
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 003-auth-session vào main.
```

### 004: Phân quyền

Trạng thái: Đã xong. Thư mục: `specs/004-permissions/`. Làm trên: branch `004-permissions` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify App mới áp dụng đúng mô hình phân quyền của Directus 11: users, roles (có cây role lồng nhau), policies, access (gán policy cho role hoặc user), permissions theo collection và action (create, read, update, delete, share) với filter điều kiện, danh sách field, validation, preset, cùng các cờ admin_access, app_access, ip_access, enforce_tfa. Accountability của mỗi request được tính giống Directus, kể cả biến động $CURRENT_USER, $CURRENT_ROLE, $CURRENT_ROLES, $CURRENT_POLICIES, $NOW. Cung cấp các endpoint /users, /roles, /policies, /access, /permissions (gồm /permissions/me và /policies/me/globals), CRUD giống Directus. /users/invite tạo user trạng thái invited giống Directus nhưng không gửi email, chỉ ghi log. Kết quả phân quyền được cache dùng chung Redis với Directus. Tham chiếu directus/api/src/permissions và các service users, roles, policies, access, permissions. Tiêu chí chấp nhận: với cùng user và dữ liệu, mọi request đọc và ghi bị chặn hoặc cho phép giống hệt Directus.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: accountability, biến động $CURRENT_*, cache quyền dùng chung, mời user không gửi email.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 004: port đầy đủ engine đọc ghi (get-ast-from-query, run-ast, ItemsService, PayloadService, MetaService, dialect helper) và các module permissions; snappy 7.3.3 nén giá trị cache, ip-matching 2.1.2; dùng chung namespace cache quyền và xóa data cache; E2E Directus app qua nginx reverse proxy với Playwright 1.64.0.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist permissions-review: kiểm yêu cầu accountability, quyền đọc ghi, cache quyền
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Xếp task theo 2 lượt commit: Lượt 1 = Phase 1 đến 4; Lượt 2 = Phase 5 đến 11. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Lượt 1 (Phase 1 đến 4). Test đối chiếu xanh, commit và push trên branch, CI xanh trước lượt sau.
```

Lượt 2:

```text
/speckit.implement Lượt 2 (Phase 5 đến 11). Test đối chiếu xanh, commit và push trên branch, CI xanh trước lượt sau.
```

### 005: CRUD items, response cache, export, event

Trạng thái: Đã xong. Thư mục: `specs/005-items/`. Làm trên: branch `005-items` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

Engine đọc và ghi (`ItemsService`, `PayloadService`, `MetaService`, `get-ast-from-query`, `run-ast`, `apply-query`,
dialect helper) và kiểm query đã port đủ ở feature 004. Feature này chỉ thêm phần còn lại.

**1. `/speckit.specify`**

```text
/speckit.specify Người dùng thao tác dữ liệu của mọi collection qua /items/:collection giống hệt Directus: đọc danh sách, đọc theo id, tạo, sửa, xóa từng cái hoặc hàng loạt, SEARCH, collection singleton. Engine đọc ghi (ItemsService, PayloadService, MetaService, run-ast, apply-query) và kiểm query đã port ở feature 004, nên feature này dùng lại, không port lại. Thêm: cache response khi CACHE_ENABLED=true (CACHE_TTL, CACHE_AUTO_PURGE, CACHE_STATUS_HEADER, Cache-Control, dùng chung key với Directus, gỡ D-11), xuất file qua query export (json, csv, xml, yaml, gỡ D-12), phát cùng tên event như Directus (items.create, items.update... và event của năm collection hệ thống, gỡ D-29 phần filter và action cho flow), và đẩy sự kiện lên kênh bus websocket.event của Directus (cùng format như directus/api/src/websocket/controllers/hooks.ts, gỡ D-30). Tham chiếu directus/api/src/controllers/items.ts, middleware/respond.ts, middleware/cache.ts, utils/get-cache-key.ts, services/import-export, emitter.ts. Tiêu chí chấp nhận: bộ blackbox test items, query và relational của Directus chạy qua trên app mới với Postgres, MySQL và SQLite.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: cache response dùng chung key với Directus, tên event, bus websocket.event, export.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 005: /items trên engine của 004; cache response dùng chung với Directus (key object-hash có version 11.17.4, Keyv data cache); export bằng json2csv 5.0.7, js2xmlparser 5.0.0, js-yaml; Emitter thật (eventemitter2 6.4.9) và cầu nối bus websocket.event theo WEBSOCKETS_*; port bộ blackbox items/query/relational vào tests/parity/src/items/blackbox.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist items-review: kiểm yêu cầu /items, cache response, export, event
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 005-items vào main.
```

### 006: Quản lý data model

Trạng thái: Đã xong. Thư mục: `specs/006-schema-management/`. Làm trên: branch `006-schema-management` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify Admin tạo, sửa, xóa collection, field và relation qua /collections, /fields, /relations giống hệt Directus. App mới tạo và sửa bảng, cột thật trong DB (đúng kiểu dữ liệu từng loại DB), đồng thời ghi metadata vào directus_collections, directus_fields, directus_relations, giống cách Directus làm. Hỗ trợ collection folder, alias field (o2m, m2m, m2a, presentation, group), field geometry, translations, archive và sort field. Hỗ trợ /schema/snapshot, /schema/diff, /schema/apply cùng format với Directus. Sau mỗi thay đổi, cache schema được xóa trên cả hai app. Tham chiếu directus/api/src/services/collections.ts, fields.ts, relations.ts, schema.ts, database/helpers. Tiêu chí chấp nhận: data model tạo ở app mới mở được và dùng bình thường trên Directus, và ngược lại.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: DDL từng vendor, schema snapshot/diff/apply, xóa cache schema ở cả hai app.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 006: port CollectionsService, FieldsService, RelationsService, SchemaService và các util snapshot; DDL thật qua dialect helper của 001/004; deep-diff 1.0.2, busboy 1.6.0, zod 4.1.12 cùng bản Directus; so DDL tuần tự trên DB dùng chung; blackbox collections/fields/schema/timezone với các profile schema-cache, schema-cache-nomsg, tz-asia, tz-america.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist schema-review: kiểm yêu cầu DDL từng vendor, snapshot/diff/apply
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 006-schema-management vào main.
```

### 007: Files, folders, assets

Trạng thái: Đã xong. Thư mục: `specs/007-files-assets/`. Làm trên: branch `007-files-assets` do Spec Kit tạo. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Người dùng tải file lên, quản lý file và thư mục qua /files, /folders, và lấy file qua /assets/:id giống hệt Directus. Hỗ trợ upload multipart, upload resumable qua TUS, import từ URL, metadata ảnh (EXIF, IPTC, kích thước), và các storage location cấu hình bằng STORAGE_* giống Directus. Chỉ hỗ trợ driver local và s3 (gồm dịch vụ tương thích S3 như MinIO). Nếu cấu hình driver khác (gcs, azure, cloudinary, supabase) thì dừng khi khởi động và báo rõ location nào không hỗ trợ. Asset hỗ trợ transform (width, height, fit, quality, format, withoutEnlargement, key preset, transforms) với cùng cách đặt tên file phát sinh như Directus, để hai app dùng chung file đã sinh. Áp dụng ASSETS_* (giới hạn transform, cache-control) và phân quyền file giống Directus. Tham chiếu directus/api/src/services/files.ts, assets.ts, tus, packages/storage*. Tiêu chí chấp nhận: file tải lên ở app này xem và tải được ở app kia, và URL asset có transform trả về ảnh giống nhau.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: driver storage chưa hỗ trợ, tên file asset sinh ra, TUS nhiều instance, ASSETS_*.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 007: port FilesService, FoldersService, AssetsService, tus/*, request/* (IMPORT_IP_DENY_LIST), synchronization; @tus/server 2.3.0, sharp 0.34.5, object-hash 3.0.0 để tên và byte của asset sinh ra giống Directus; chỉ storage local và s3 (D-16); env đối chiếu thêm volume uploads, files-fixtures, profile assets-limit, assets-stress; service backoffice ghim linux/amd64.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist files-review: kiểm yêu cầu storage, asset transform, TUS
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 007-files-assets vào main.
```

### 008: Activity, revisions, versions, comments

Trạng thái: Đã xong. Thư mục: `specs/008-activity-revisions-versions/`. Làm trên: branch `008-activity-revisions-versions` do Spec Kit tạo. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify App mới ghi và cung cấp lịch sử thay đổi giống hệt Directus: /activity (ai làm gì, lúc nào, IP, user agent), /revisions (dữ liệu trước và sau, delta), khôi phục item về một revision, /versions (content versioning: tạo bản nháp, so sánh, promote về bản chính), /comments trên item. Áp dụng cấu hình ACTIVITY và REVISIONS giống Directus. Tham chiếu directus/api/src/services/activity.ts, revisions.ts, versions.ts, comments.ts. Tiêu chí chấp nhận: lịch sử do app mới ghi hiển thị đúng trong Directus, và version tạo ở bên này promote được ở bên kia.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: ACTIVITY/REVISIONS, promote version, mention trong comment không gửi email, retention.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 008: port ActivityService, RevisionsService, VersionsService, CommentsService, NotificationsService; mention ghi directus_notifications, không gửi email (D-33); job retention (RETENTION_*, lock dùng chung schedule--data-retention); object-hash 3.0.0 cho hash của version; suite tests/parity/src/history, profile retention.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist history-review: kiểm yêu cầu activity, revisions, versions, comments
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 008-activity-revisions-versions vào main.
```

### 009: Flows và tự động hóa

Trạng thái: Đã xong. Thư mục: `specs/009-flows-automation/`. Làm trên: branch `009-flows-automation` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify App mới chạy flows giống hệt Directus. Flow và operation lưu trong directus_flows và directus_operations. Hỗ trợ các trigger: event (hook action và filter trên items và các collection hệ thống, cùng tên event như Directus), schedule (cron), webhook (/flows/trigger/:id, GET/POST, đồng bộ hoặc bất đồng bộ), manual (nút bấm trên item) và another flow. Hỗ trợ mọi operation có sẵn: condition, exec, item-create/read/update/delete, json-web-token, log, mail, notification, request, sleep, transform, trigger flow, throw error. Operation exec (Run Script) chạy JavaScript trong sandbox isolated-vm với giới hạn FLOWS_RUN_SCRIPT_MAX_MEMORY và FLOWS_RUN_SCRIPT_TIMEOUT giống Directus. Operation mail không gửi email, chỉ ghi log và trả kết quả thành công như khi gửi xong. Hỗ trợ dữ liệu $trigger, $last, $accountability, $env và nhánh resolve/reject. Flow theo lịch dùng lock trên Redis, nên khi cả Directus và app mới cùng chạy thì mỗi lượt chỉ một bên thực thi. Khi flow thay đổi ở app này, app kia nạp lại flow qua bus. Log chạy flow ghi vào activity và revisions giống Directus. Tham chiếu directus/api/src/flows.ts, operations, services/flows.ts, operations.ts. Tiêu chí chấp nhận: cùng một flow cho kết quả giống nhau ở hai app, và flow theo lịch không bị chạy hai lần.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: lock flow theo lịch, operation mail không gửi, sandbox Run Script, nạp lại flow qua bus.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 009: port flows.ts (FlowManager: event filter/action, schedule qua SynchronizedClock trên Redis, webhook /flows/trigger/:id, manual, operation) và 15 operation có sẵn (exec trong isolated-vm 5.0.3 với FLOWS_RUN_SCRIPT_*, mail chỉ ghi log D-34); FlowsService/OperationsService nạp lại qua kênh bus flows; micromustache 8.0.3, p-queue 8.1.0; suite tests/parity/src/flows, profile flows-schedule.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist flows: kiểm yêu cầu trigger, operation, lock theo lịch
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 009-flows-automation vào main.
```

### 010: Collection hệ thống còn lại

Trạng thái: Đã xong. Thư mục: `specs/010-system-collections/`. Làm trên: branch `010-system-collections` do Spec Kit tạo. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify App mới cung cấp các endpoint hệ thống còn lại giống hệt Directus: /settings (cài đặt dự án, theme, branding), /presets (preset và bookmark của layout), /notifications (lưu và hiển thị trong app, không gửi email), /shares (chia sẻ item bằng link, mật khẩu, thời hạn, số lần xem, đăng nhập bằng share), /translations (chuỗi dịch tùy chỉnh), /dashboards và /panels (insights), /extensions (chỉ trả danh sách rỗng hoặc tối thiểu, vì chưa hỗ trợ extension), /utils (hash/generate, hash/verify, random/string, sort, revert, cache/clear, import, export với CSV, JSON, XML, YAML), Không gửi email: mọi chỗ Directus gửi mail thì bỏ qua bước gửi và ghi log cảnh báo, phần còn lại của luồng chạy như cũ. Tham chiếu các service tương ứng trong directus/api/src/services. Tiêu chí chấp nhận: blackbox test của các endpoint này chạy qua trên app mới.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: /server/setup, đăng nhập bằng share, /extensions khi chưa hỗ trợ extension, import/export của /utils.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 010: SettingsService, POST /server/setup, /presets, /notifications, /translations, /dashboards, /panels, /shares (invite chỉ ghi log, D-36), /extensions (đọc, registry qua client port với ky 1.14.0, cài gỡ trả 503 D-37), UtilsService, ImportService (papaparse 5.5.3, stream-json 1.9.1, async 3.2.6, bộ đếm import trên Redis), ExportService; suite tests/parity/src/system, profile setup, fake registry.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist system: kiểm yêu cầu các collection hệ thống còn lại
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 010-system-collections vào main.
```

### 011: GraphQL

Trạng thái: Đã xong. Thư mục: `specs/011-graphql-api/`. Làm trên: branch `011-graphql-api` do Spec Kit tạo. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify App mới cung cấp /graphql (dữ liệu người dùng) và /graphql/system (dữ liệu hệ thống), có schema sinh động từ data model và phân quyền của từng user, giống hệt Directus: query, mutation, aggregate, quan hệ lồng nhau, filter, đặt tên type và field giống nhau. Không làm subscription. Tham chiếu directus/api/src/services/graphql. Tiêu chí chấp nhận: introspection schema của app mới khớp với Directus cho cùng user, và các blackbox test GraphQL chạy qua.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Tập trung: tên type và field, introspection theo user, subscription, cache schema GraphQL.
```

**3. `/speckit.plan`**

```text
/speckit.plan Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 011: port services/graphql (schema theo user bằng graphql-compose 9.1.0 + graphql 16.12.0, resolver trên engine 004/005 và service 003–010, giữ type Subscription không có transport D-17), middleware parseGraphQL, /server/specs/graphql; cache schema LRU trong process (mnemonist 0.40.3) xóa qua bus schemaChanged; async-mutex 0.5.0; suite tests/parity/src/graphql so introspection và SDL nguyên văn, profile graphql-nointro.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist api-compat: kiểm yêu cầu tương thích GraphQL (thêm operations, testing nếu cần)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks
```

**6. `/speckit.analyze`**

```text
/speckit.analyze
```

**7. `/speckit.implement`**

```text
/speckit.implement Chạy test đối chiếu sau mỗi phase. Xong thì chạy đủ test đối chiếu, graphify update ., rồi merge branch 011-graphql-api vào main.
```

### 012: Khung app web và đăng nhập

Trạng thái: Đã xong. Thư mục: `specs/012-backoffice-web-shell/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/012-backoffice-web-shell và đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Xây app web quản trị mới mang tên Backoffice thay cho Directus app, giữ nguyên luồng sử dụng. Mọi chữ Directus mà người dùng thấy (tiêu đề, logo, favicon, trang đăng nhập, chuỗi dịch, tên mặc định khi project_name trống) đổi thành Backoffice. Nếu settings trong DB đã có tên dự án, logo hoặc màu riêng thì dùng các giá trị đó, giống Directus. Người dùng đăng nhập bằng email và mật khẩu, TFA, LDAP hoặc SSO (OpenID Connect, OAuth2), rồi được giữ phiên bằng refresh token. Đăng xuất, quên mật khẩu, nhận lời mời (giữ màn hình như Directus; vì hệ thống không gửi email nên hiện thêm hướng dẫn liên hệ admin), cập nhật hồ sơ, theme sáng/tối, ngôn ngữ vi-VN và en-US (dùng chuỗi dịch của Directus). Bố cục gồm thanh module bên trái, thanh điều hướng, vùng nội dung và sidebar bên phải như Directus. Các route giống Directus (/admin/content, /admin/files, /admin/users, /admin/insights, /admin/activity, /admin/settings). App chỉ gọi API theo đúng chuẩn Directus, nên chạy được với cả Directus thật lẫn API mới chỉ bằng cách đổi URL. Hỗ trợ desktop và tablet từ 768px trên Chrome, Edge, Firefox, Safari bản mới. Phần nhìn (màu, chữ, khoảng cách, bo góc, component) theo bộ design-system/ của dự án; màu, logo trong settings áp lên trên design-system như Directus (project_color tô nền logo, trang đăng nhập, trang share, favicon; theme sáng/tối tùy chỉnh trong settings đè màu tương ứng); những chỗ design-system chưa chốt (màu primary, font, màu trạng thái, theme tối) ghi thành câu hỏi mở. Tham chiếu directus/app/src (router, auth, stores, views) và design-system/. Tiêu chí chấp nhận: đăng nhập vào Directus thật và vào API mới đều chạy, điều hướng giữa các module giống Directus.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Tập trung: màn chưa có mẫu trong design-system, branding từ settings, luồng cần email, ba cấu hình chạy (Directus, API mới, khác site).
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 012: apps/web là khung app (đăng nhập local/TFA/LDAP/SSO, chế độ session qua @directus/sdk 21.3.0 là client duy nhất; khung TailAdmin gồm sidebar, header, page header, panel chi tiết, sáu module giữ chỗ), branding từ settings trên theme design-system, chuỗi en-US/vi-VN sinh từ directus/app/src/lang bằng script commit sẵn; Reka UI 2.8.2, Tailwind CSS 4.3, @vueuse/core 14.0.0, @unhead/vue 1.11.20, qrcode 1.5.4, marked 16.4.1, dompurify; Playwright apps/web-e2e ba cấu hình (proxy tới Directus, proxy tới API mới, CORS khác site), profile web.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Xếp task theo 5 lượt commit: Đợt A = Phase 1, 2; Đợt B = Phase 3, 4, 5; Đợt C = Phase 6, 7, 8; Đợt D = Phase 9, 10; Phase 11 = Phase 11 (khung TailAdmin). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Đợt A:

```text
/speckit.implement Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Đợt A (Phase 1, 2). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Đợt B:

```text
/speckit.implement Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Đợt B (Phase 3, 4, 5). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Đợt C:

```text
/speckit.implement Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Đợt C (Phase 6, 7, 8). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Đợt D:

```text
/speckit.implement Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Đợt D (Phase 9, 10). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Phase 11:

```text
/speckit.implement Đặt SPECIFY_FEATURE=012-backoffice-web-shell khi chạy script .specify. Phase 11 (Phase 11 (khung TailAdmin)). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Ghi chú: prompt trên là bản gốc. Sau Phase 11 của 012, bố cục khung và phần nhìn theo design-system TailAdmin (D-47,
D-52 trong spec 012), không còn giống Directus app.

### 013: Bộ interfaces và displays

Trạng thái: Đã xong. Thư mục: `specs/013-interfaces-displays/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/013-interfaces-displays và đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. App web cần bộ interface (ô nhập dữ liệu) và display (cách hiển thị giá trị) tương đương Directus, để form và bảng hiển thị đúng theo cấu hình field trong directus_fields (interface, options, display, display_options). Interfaces: input, textarea, code, rich text HTML, markdown, block editor, hash, boolean, datetime, slider, select (dropdown, radio, checkbox, multi, icon, color, tree), tags, file, image, files, map, list (repeater), quan hệ m2o, o2m, m2m, m2a, tree view, translations, nhóm field (accordion, detail, raw, tabs), presentation (divider, header, links, notice), autocomplete từ API. Displays tương ứng. Đọc đúng options đã lưu bởi Directus, để field cấu hình ở Directus hiển thị đúng ở app mới. Tham chiếu directus/app/src/interfaces và displays. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: mọi interface và display có sẵn trong Directus đều có bản tương ứng, và đọc được cấu hình hiện có.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Tập trung: interface và display chưa có mẫu trong design-system, thư viện phải ghim theo Directus, options đã lưu.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 013: 40 interface + 18 display + system-raw-editor port từ directus/app/src/{interfaces,displays} (cùng id, type, khóa option), BoForm (port v-form), RenderDisplay/RenderTemplate, drawer item/collection/batch/files, BoUpload; thư viện ghim theo Directus 11.17.4 (tinymce 6.8.6, @editorjs/editorjs 2.31.2, codemirror 5.65.18, maplibre-gl, @mapbox/mapbox-gl-draw 1.5.1...); Vitest project unit (happy-dom) và browser (@vitest/browser, chromium, axe-core); bộ mẫu apps/web/fixtures/interfaces seed qua Directus REST.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Xếp task theo 4 lượt commit: Đợt A = Phase 1, 2, 3, 4, 8; Đợt B = Phase 5, 6; Đợt C = Phase 7, 9; Đợt D = Phase 10. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Đợt A:

```text
/speckit.implement Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Đợt A (Phase 1, 2, 3, 4, 8). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Đợt B:

```text
/speckit.implement Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Đợt B (Phase 5, 6). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Đợt C:

```text
/speckit.implement Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Đợt C (Phase 7, 9). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Đợt D:

```text
/speckit.implement Đặt SPECIFY_FEATURE=013-interfaces-displays khi chạy script .specify. Đợt D (Phase 10). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

### 014: Module Content

Trạng thái: Đã xong 2026-10-16 (bốn lượt, 91025bb). Thư mục: `specs/014-content-module/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/014-content-module và đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Người dùng duyệt và chỉnh sửa dữ liệu trong module Content giống Directus: danh sách collection theo nhóm và folder, xem item với các layout table, cards, calendar, kanban và map (nguồn tile bản đồ cấu hình được như Directus: Mapbox key hoặc tile server riêng), tìm kiếm, lọc, sắp xếp, chọn cột, lưu bookmark và preset, xuất và nhập dữ liệu, thao tác hàng loạt. Trang chi tiết item có form theo cấu hình field, điều kiện ẩn hiện field, validation, lưu và lưu tiếp, xóa, archive, sidebar revisions, comments, versions và chia sẻ. Hỗ trợ collection singleton. Chỉ hiện những gì user có quyền. Danh sách phải mượt với collection khoảng 10 triệu bản ghi (phân trang và đếm phía server). Tham chiếu directus/app/src/modules/content và layouts. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: các luồng chính của module Content trên Directus làm được tương tự trên app mới.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Tập trung: collection 10 triệu dòng, preset và bookmark dùng chung, layout chưa có mẫu, cách chia lượt.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 014: route /content, /content/:collection, /content/:collection/:primaryKey(/preview); cây collection trong sub-menu; preset và bookmark dùng chung (port use-preset); năm layout (tabular, cards, calendar trên @fullcalendar/* 6.1.19, kanban, map) sau wrapper use-layout; search + system-filter; trang item trên BoForm với use-item, versions, sidebar chi tiết, live preview (@directus/vue-split-panel 0.8.9); @json2csv/plainjs 7.0.6 + file-saver 2.0.5; E2E content-*.spec.ts ba cấu hình, bộ so payload với Directus app, benchmark web hằng tuần trên seed 10 triệu dòng.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Xếp task theo 4 lượt commit: Lượt 1 = Phase 1 đến 5; Lượt 2 = Phase 6; Lượt 3 = Phase 7; Lượt 4 = Phase 8 đến 10. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Lượt 1 (Phase 1 đến 5). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Lượt 2 (Phase 6). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Lượt 3 (Phase 7). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 4:

```text
/speckit.implement Đặt SPECIFY_FEATURE=014-content-module khi chạy script .specify. Lượt 4 (Phase 8 đến 10). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Ghi chú từ 013 (đưa vào spec 014): 013 chỉ làm component (form, interface, display, drawer), không có màn hình. 014
nhận: màn item `/content/:collection/:primaryKey` dùng `BoForm`, lưu item, hỏi `unsaved_changes` (FR-084 của 013); E2E
ba cấu hình và so payload ghi với Directus app trên bộ mẫu `apps/web/fixtures/interfaces` (dùng lại script seed); drawer
chọn item theo layout của preset và bộ lọc nâng cao (D-58); màn revisions, versions và chế độ so sánh (D-55); nội dung
module Content (D-40); sự kiện "flow đã chạy" của `header` để nạp lại item.

### 015: Module Files và Users

Trạng thái: Đã xong 2026-10-16 (bốn lượt). Thư mục: `specs/015-files-users-modules/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/015-files-users-modules và đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Module Files: thư viện file theo thư mục, tải lên (kéo thả, nhiều file, từ URL), xem trước, sửa metadata, chỉnh sửa ảnh (cắt, xoay), di chuyển và xóa, lọc và tìm kiếm. Module Users: danh sách user theo role, tạo user, mời user (không gửi email), sửa hồ sơ, đổi role và policy, khóa user, tạo static token, bật tắt TFA. Luồng và quyền giống Directus. Tham chiếu directus/app/src/modules/files và users. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: các luồng chính của hai module chạy giống Directus.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Tập trung: TUS, chỉnh ảnh, interface _system của màn user, mời user không gửi email.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 015: route /files (thư viện theo folder, cây folder trong sub-menu, folder card, upload, TUS qua tus-js-client 4.3.1, màn file) và /users (danh bạ theo trạng thái và role, mời không gửi email, màn user với sáu interface _system); ImageEditor dùng chung trên cropperjs 1.6.2; E2E files-*/users-* ba cấu hình, payload suite files/users, so pixel ảnh đã sửa.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Xếp task theo 4 lượt commit: Lượt 1 = Phase 1 đến 4; Lượt 2 = Phase 5; Lượt 3 = Phase 6, 7; Lượt 4 = Phase 8 đến 10. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Lượt 1 (Phase 1 đến 4). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Lượt 2 (Phase 5). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Lượt 3 (Phase 6, 7). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 4:

```text
/speckit.implement Đặt SPECIFY_FEATURE=015-files-users-modules khi chạy script .specify. Lượt 4 (Phase 8 đến 10). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
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

Trạng thái: Đã xong 2026-10-17 (năm lượt, 953c64b). Thư mục: `specs/016-settings-module/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/016-settings-module và đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Module Settings cho admin, giống Directus: data model (tạo và sửa collection, field, relation, sắp xếp và nhóm field, cấu hình interface và display, điều kiện, validation), roles và policies (gán quyền theo collection, action, field, điều kiện lọc), cài đặt dự án (tên, logo, màu, theme, ngôn ngữ, bản đồ, giới hạn file), presets và bookmarks, translations, thông tin hệ thống. Tham chiếu directus/app/src/modules/settings. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: data model và quyền tạo trên app mới dùng được ngay trên Directus.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Tập trung: drawer field, ma trận quyền, màn chưa có mẫu, các link từ Content và Users.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 016: /settings/{data-model,roles,policies,project,appearance,presets,translations} port từ directus/app/src/modules/settings (store field-detail + 10 alteration, ma trận system-permissions, ExtensionOptions), 18 interface _system còn lại, helper ghi trên store collections/fields/relations, dữ liệu quyền tĩnh đồng bộ từ Directus (web:sync-permissions-data); E2E settings-* ba cấu hình, bộ dùng chéo trên Directus app.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Xếp task theo 5 lượt commit: Lượt 1 = Phase 1 đến 4; Lượt 2 = Phase 5; Lượt 3 = Phase 6; Lượt 4 = Phase 7, 8; Lượt 5 = Phase 9, 10. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Lượt 1 (Phase 1 đến 4). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Lượt 2 (Phase 5). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Lượt 3 (Phase 6). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 4:

```text
/speckit.implement Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Lượt 4 (Phase 7, 8). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 5:

```text
/speckit.implement Đặt SPECIFY_FEATURE=016-settings-module khi chạy script .specify. Lượt 5 (Phase 9, 10). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
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

Trạng thái: Đã xong 2026-10-17 (e61eae1). Thư mục: `specs/017-flows-editor/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/017-flows-editor và đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Admin tạo và chỉnh sửa flow bằng giao diện kéo thả như Directus: chọn trigger, thêm operation, nối nhánh resolve và reject, cấu hình từng operation, bật tắt flow, xem log các lần chạy. Nút chạy flow thủ công hiện trên trang item hoặc danh sách item. Tham chiếu directus/app/src/modules/settings/routes/flows và directus/app/src/operations. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: flow tạo ở app mới mở và sửa được trên Directus, và ngược lại.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Tập trung: canvas kéo thả và a11y, staging khi lưu, log flow.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 017: /settings/flows, /settings/flows/:primaryKey(/:operationId) port từ directus/app/src/modules/settings/routes/flows (bảng tổng quan, drawer flow 5 trigger, canvas lưới 18 px với mũi tên SVG, staging + một PATCH /flows/:id khi lưu, drawer operation với 15 operation dạng registry tĩnh src/operations, log từ /revisions); BoWorkspace/BoWorkspaceTile dùng chung với 018; canvas chỉ dùng chuột như Directus (ngoại lệ a11y); E2E settings-flows-*, payload suite flows.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Xếp task theo 4 lượt commit: Lượt 1 = Phase 1, 2, 3; Lượt 2 = Phase 4, 5; Lượt 3 = Phase 6, 7; Lượt 4 = Phase 8, 9. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Lượt 1 (Phase 1, 2, 3). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Lượt 2 (Phase 4, 5). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Lượt 3 (Phase 6, 7). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 4:

```text
/speckit.implement Đặt SPECIFY_FEATURE=017-flows-editor khi chạy script .specify. Lượt 4 (Phase 8, 9). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Ghi chú từ 016 (đưa vào spec 017): mục "Flows" của sub-menu Settings và `/settings/flows(/*)` đang là khung của 012
(D-92 của 016); `/content/directus_flows` cũng trỏ về đó (D-72). Đã có sẵn ba interface `_system` mà màn flow dùng:
`system-manual-flow-select`, `system-collections`, `system-inline-fields` (port của Directus, 016).

### 018: Insights, Activity, Notifications

Trạng thái: Đã xong 2026-10-18 (12b7246). Thư mục: `specs/018-insights-activity-notifications/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/018-insights-activity-notifications và đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Module Insights: tạo dashboard, thêm và sắp xếp panel (metric, metric list, meter, time series, line chart, bar chart, pie chart, list, label, variable, relational variable), lọc theo biến dashboard. Module Activity: xem nhật ký hoạt động, lọc theo user, collection, hành động. Notifications: chuông thông báo, đánh dấu đã đọc, mở item liên quan. Luồng giống Directus. Tham chiếu directus/app/src/modules/insights, activity, directus/app/src/panels. Giao diện theo design-system/ (TailAdmin: theme, component-specs, layout-patterns; dùng khung app của 012); màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: dashboard tạo ở Directus hiển thị đúng trên app mới.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Tập trung: panel biểu đồ, biến dashboard, notifications, kéo thả và đổi cỡ tile.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 018: /insights, /insights/:primaryKey(/:panelKey), /activity(/:primaryKey) port từ directus/app/src/modules/{insights,activity} và stores/insights.ts; 11 panel dạng registry tĩnh src/panels (apexcharts 4.7.0, màu mặc định từ token D-108, bảng sr-only cho biểu đồ); dữ liệu panel qua một POST /graphql gộp; biến dashboard; danh sách activity trên layout wrapper của 014; chuông + drawer thông báo; E2E insights-*/activity/notifications, payload suite, fixture bo_insights.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature FE (design-system, a11y, ba cấu hình)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Xếp task theo 4 lượt commit: Lượt 1 = Phase 1 đến 4; Lượt 2 = Phase 5, 6; Lượt 3 = Phase 7, 8, 9; Lượt 4 = Phase 10, 11. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Lượt 1 (Phase 1 đến 4). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Lượt 2 (Phase 5, 6). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Lượt 3 (Phase 7, 8, 9). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 4:

```text
/speckit.implement Đặt SPECIFY_FEATURE=018-insights-activity-notifications khi chạy script .specify. Lượt 4 (Phase 10, 11). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
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

Trạng thái: Đã xong 2026-10-20 (56/56 task, CI 39371162920). Thư mục: `specs/019-deployment-packaging/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/019-deployment-packaging và đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Đóng gói app mới để triển khai: FE chạy 1 container, BE chạy nhiều container sau load balancer, cùng DB và Redis với Directus. FE: image nginx phục vụ file tĩnh ở /admin, đọc URL API và cấu hình từ biến môi trường lúc container khởi động, fallback về index.html cho route của SPA. BE: image chạy được với số replica tùy ý, không cần sticky session, có readiness và liveness probe qua /server/health, tắt máy an toàn khi nhận SIGTERM (ngừng nhận request, chạy nốt request đang dở, đóng kết nối DB và Redis). Định tuyến chung một domain: /admin/* vào FE, các path còn lại vào BE. Cung cấp docker-compose cho máy dev (Directus 11.17.4, BE 2 replica, FE, Postgres, Redis, MinIO làm S3) và manifest Kubernetes hoặc Helm chart cho môi trường thật (Deployment, Service, Ingress, HPA cho BE, dùng lại nguyên ConfigMap và Secret đang cấp cho Directus, không khai báo lại biến). Thay một instance Directus bằng BE mới chỉ cần đổi image, giữ nguyên toàn bộ biến môi trường. Tiêu chí chấp nhận: với BE 3 replica cộng 1 Directus, các bài test sau đều đạt: đăng nhập rồi gọi API lần lượt vào từng replica; sửa schema ở một replica thì replica khác thấy ngay; flow theo lịch chỉ chạy một lần mỗi lượt; upload TUS nhiều chunk qua các replica khác nhau vẫn thành công; tắt một replica khi đang tải không làm lỗi request.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Tập trung: uid container, CSP, lb có Directus trong pool, Helm dùng lại ConfigMap/Secret của Directus.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Node 22, pnpm 10, Nx monorepo. Feature 019 không đổi code API: image build bằng @nx-tools/nx-container 7.3.0 (target container, linux/amd64); image API chạy node uid 1000 dưới tini; image web nginx-unprivileged uid/gid 1001 phục vụ /admin (index no-cache, file immutable, CSP từ CONTENT_SECURITY_POLICY_* lúc start); deploy/compose (Directus 11.17.4, BE replica theo BACKOFFICE_REPLICAS, FE, Postgres, Redis, MinIO, lb nginx unprivileged có Directus trong pool; override separate-domain); deploy/helm/backoffice (Deployment/Service/Ingress/HPA, envFrom ConfigMap/Secret của Directus, label pool backoffice.io/api-pool, readiness /server/health, liveness /server/ping, preStop sleep, kiểm tra lúc install); suite tests/parity/src/deploy và job CI deploy, deploy-k8s (kind).
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. requirements: kiểm yêu cầu image, compose, Helm, acceptance nhiều replica
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Xếp task theo 4 lượt commit: Lượt 1 = Phase 1 đến 4; Lượt 2 = Phase 5 đến 8; Lượt 3 = Phase 9, 10; Lượt 4 = Phase 11. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Lượt 1 (Phase 1 đến 4). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Lượt 2 (Phase 5 đến 8). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Lượt 3 (Phase 9, 10). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 4:

```text
/speckit.implement Đặt SPECIFY_FEATURE=019-deployment-packaging khi chạy script .specify. Lượt 4 (Phase 11). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

### 020: Extensions

Trạng thái: Đã xong 2026-10-22 (100/100 task, CI 39736093957). Thư mục: `specs/020-extensions/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/020-extensions và đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Hỗ trợ extension của Directus 11.17.4 trên API mới và app web mới: extension đã build cho Directus chạy được mà không cần build lại. Gỡ D-37, phần extensions của D-45, phần Extensions/Marketplace của D-93. Loại trong phạm vi: interface, display, layout, module, panel, hook, endpoint, operation, bundle; ngoài phạm vi: theme. API: port directus/api/src/extensions (manager, get-extensions, sync, installation, sandbox, wrap-embeds); nạp hook (filter, action, init, schedule, embed), endpoint, operation với cùng context như Directus (services, database, getSchema, env, logger, emitter...); env EXTENSIONS_PATH, EXTENSIONS_LOCATION, EXTENSIONS_MUST_LOAD, EXTENSIONS_AUTO_RELOAD, EXTENSIONS_SANDBOX_MEMORY, EXTENSIONS_SANDBOX_TIMEOUT; extension sandboxed chạy trong isolated-vm; /extensions trả schema thật, PATCH bật tắt, cài gỡ từ registry (bỏ 503), GraphQL extensions và update_extensions_item theo cùng hành vi. Nhiều instance (compose N replica, k8s nhiều pod, HPA): mọi node trong pool, cả Directus lẫn Backoffice, nạp cùng một bộ extension; bắt buộc EXTENSIONS_LOCATION khi chạy nhiều replica và Helm kiểm tra lúc install; reload qua kênh bus chung extensions.reload (cùng payload partialSync, origin); hook schedule dùng cùng tên lock <tên>:<index> với Directus; pod chỉ ready sau khi sync và nạp xong. Web, tương thích hoàn toàn: nạp /extensions/sources/index.js, đăng ký lúc chạy vào registry interface, display, layout, module, panel, operation; shim toàn bộ 77 component toàn cục v-* (directus/app/src/components/register.ts), PrivateView, PublicView, SharedView, 7 directive toàn cục, inject useStores, useApi (AxiosInstance), useSdk, useExtensions, shared deps vue, vue-router, vue-i18n, pinia, @directus/extensions-sdk, biến CSS --theme--* ánh xạ sang token. Shim theo design-system/ (TailAdmin): bọc Bo* khi đã có, giữ đủ props, slot, emit của v-*; component chưa có thì viết mới trên Reka UI và token theme, đủ trạng thái và bàn phím theo docs/component-specs.md. Màn Settings > Extensions và Marketplace theo design-system; màn chưa có mẫu thì ghi câu hỏi mở. Tiêu chí chấp nhận: cùng một bộ extension mẫu (mỗi loại một cái) chạy giống nhau trên Directus và app mới; hook bắn cùng event, endpoint trả cùng response, flow có operation tùy biến cho cùng kết quả; props, slot, emit của từng v-* shim khớp Directus; với BE 3 replica cộng 1 Directus (compose và kind): cài ở một node thì mọi node thấy, gỡ thì mọi node trả 404, hook schedule chạy một lần mỗi lượt, scale lên thì pod mới có extension trước khi ready.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Tập trung: shim v-*, shared dep của bundle, nhiều instance, marketplace, sandbox.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Phần chung BE: Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Phần chung FE: Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 020: port directus/api/src/extensions (manager, get-extensions, dòng settings, sync từ EXTENSIONS_LOCATION có lock theo máy, cài từ registry qua tar 7.5.19, sandbox isolated-vm, app bundle bằng rollup 4.59.0/rolldown với shared dep dạng bare specifier); 8 init event; endpoint trên app Express 4.21.2 (alias express4) gắn vào Nest Express 5; web: import map trong index.html cho vue, vue-router, vue-i18n, pinia 2.3.1, @directus/extensions-sdk; registry lúc chạy; apps/web/src/directus-shim (77 v-*, 3 view, 7 directive, 4 inject, useApi trên axios 1.15.0); 173 biến --theme--*; Settings > Extensions và Marketplace; fixtures tests/fixtures/extensions, profile extensions.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. release-gate: kiểm yêu cầu trước khi đóng feature (shim, nhiều instance, marketplace)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Xếp task theo 3 lượt commit: Lượt 1 = Phase 1 đến 6, trừ T096; Lượt 2 = Phase 7 đến 9; Lượt 3 = Phase 10 đến 12 và T096. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Lượt 1 (Phase 1 đến 6, trừ T096). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Lượt 2 (Phase 7 đến 9). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=020-extensions khi chạy script .specify. Lượt 3 (Phase 10 đến 12 và T096). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
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

Trạng thái: Đã xong 2026-10-22 (ba lượt trên `main`). Thư mục: `specs/021-standalone-init-cli/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

**0. `/speckit.constitution`**

Feature 021 trái với Nguyên tắc II ("Không chạy migration hệ thống. Chỉ Directus được migrate.") và VII ("KHÔNG ghi gì vào bảng hệ thống khi khởi động"). Chạy prompt sau trước `/speckit.specify` của 021, rồi cho tech lead duyệt. Đã chạy ngày 2026-10-22: constitution 3.0.0, prompt nguồn mục II, VII ở trên đã sửa theo; tech lead (chủ dự án) duyệt 2026-10-22.

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

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/021-standalone-init-cli và đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Backoffice chạy độc lập: tự khởi tạo DB, chạy migration và có CLI giống Directus 11.17.4. Khởi động: image API chạy bootstrap rồi start giống directus/Dockerfile, không hỏi gì. DB trống: chờ DB 5 lần x 5 giây, chạy 15 seed yaml, migrate latest, createAdmin từ ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_TOKEN, ghi PROJECT_NAME, setOwner khi PROJECT_OWNER là email (không gửi report, D-38). DB đã cài: chỉ migrate latest. Không có lock, giống Directus. Vendor: Backoffice tự khởi tạo và migrate với Postgres và SQLite; vendor khác thì DB do Directus khởi tạo và migrate, Backoffice chỉ kiểm tra directus_migrations như hiện nay (ghi thành khác biệt). CLI cho apps/api, port directus/api/src/cli với cùng lệnh, option, log và exit code: start, init, bootstrap [--skipAdminInit], database install, database migrate:latest|up|down, users create|passwd, roles create, cache clear [--system|--data], count <collection>, schema snapshot|apply, security key:generate|secret:generate. Lệnh init chỉ hiện các vendor Backoffice hỗ trợ khởi tạo (Postgres, SQLite) và không chạy npm install driver vì driver đã có trong image (ghi thành khác biệt); dùng DB khác thì khởi tạo bằng Directus. Migration: port nguyên văn directus/api/src/database/migrations/run.ts và 101 file của 11.17.4, cùng custom migration trong MIGRATIONS_PATH; ghim 11.17.4. Tương thích: DB do Backoffice bootstrap thì Directus 11.17.4 khởi động, đăng nhập và migrate được, và ngược lại; validate-migrations.ts vẫn đạt. Deploy chế độ độc lập: compose có service chạy bootstrap một lần rồi mới start các replica API, không có Directus; Helm có Job hook pre-install/pre-upgrade tạo pod riêng chạy bootstrap một lần, Deployment chỉ tạo sau khi Job xong và pod API chỉ chạy start, ConfigMap/Secret mà Job cần phải có trước Job, không cần ConfigMap, Secret hay PVC của Directus; chế độ chạy chung của 019 giữ nguyên. Ngoài phạm vi khi chạy độc lập: gửi email, WebSocket, SAML, storage ngoài Local/S3 và các mục XI khác; liệt kê trong "Khác biệt so với Directus". Test đối chiếu trên Postgres và SQLite: bootstrap DB trống bằng Directus và bằng Backoffice rồi so sánh schema, các hàng hệ thống (bỏ qua uuid, thời gian, hash) và directus_migrations; chạy migrate latest/up/down với bộ custom migration mẫu ở cả hai app; so sánh output và exit code của từng lệnh CLI; acceptance deploy độc lập trên compose và kind (install, rồi upgrade có custom migration mới).
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Tập trung: vendor ngoài Postgres/SQLite, chạy bootstrap nhiều replica, Helm Job, output và exit code của CLI.
```

**3. `/speckit.plan`**

```text
/speckit.plan Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Feature 021: port directus/api/src/cli (commander 14.0.2, inquirer 12.11.0, chalk 5.6.2, liquidjs 10.27.2); apps/api/cli.js; image CMD node cli.js bootstrap && exec node cli.js start dưới tini; 15 seed yaml + seeds/run.ts; 101 migration 11.17.4 port nguyên văn + migrations/run.ts (port.test.ts kiểm); bootstrap, install, migrate chỉ Postgres và SQLite (D-145); compose override docker-compose.standalone.yml, Helm mode: standalone với Job pre-install/pre-upgrade; profile bootstrap.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. pre-tasks: kiểm yêu cầu trước khi chia task (bootstrap, migrate, CLI, deploy độc lập)
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Xếp task theo 3 lượt commit: Lượt 1 = Phase 1 đến 6; Lượt 2 = Phase 7, 8; Lượt 3 = Phase 9 đến 11. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Lượt 1 (Phase 1 đến 6). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Lượt 2 (Phase 7, 8). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=021-standalone-init-cli khi chạy script .specify. Lượt 3 (Phase 9 đến 11). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
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

Trạng thái: đã xong. Ba lượt trên `main` (`a948e3f0`..`173403ae`), 46/46 task, CI 40308977164 xanh, parity-matrix 40320127600 và benchmark-web 40320123598 xanh; D-179..D-182 đã duyệt (D-182: tiêu đề card ba toggle chỉ ở web). Chủ dự án 2026-10-26: MySQL tạm bỏ khỏi CI rồi bật lại cùng ngày. Kết quả từng lượt ở `research.md` "Kết quả lượt 1/2/3". Thư mục: `specs/022-collection-ui-toggles/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

Lưu ý: không stage `apps/api/project.json`, `apps/web/project.json` (thay đổi của session khác). Bước 0 chạy
trước `/speckit.plan`.

**0. `/speckit.constitution`**

Feature 022 trái với Nguyên tắc II ("KHÔNG ĐƯỢC thêm bảng, cột hay migration hệ thống riêng của Backoffice") và VII ("bootstrap không có lock, như Directus"). Chạy prompt sau trước `/speckit.plan` của 022, rồi cho tech lead duyệt. Đã chạy ngày 2026-10-26: constitution 3.2.0, theo yêu cầu của chủ dự án (kiêm tech lead).

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

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/022-collection-ui-toggles và đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Ẩn hiện ô tìm kiếm, Import, Export theo từng collection trong module Content của Backoffice, kèm bộ migration riêng của Backoffice. Dữ liệu: thêm ba cột vào directus_collections: bo_show_search, bo_show_import, bo_show_export, boolean, mặc định true, cho phép null; null hoặc chưa có cột thì hiểu là hiện (như hiện nay). Admin sửa ba cài đặt trong form collection của Settings > Data Model; nhãn en-US, vi-VN lấy từ ba dòng directus_fields (interface boolean, width half), nên Backoffice và Directus app cùng hiện ba toggle. Cài đặt áp dụng cho mọi người dùng, kể cả admin. Ô tìm kiếm: khi bo_show_search tắt, trang /content/:collection chỉ ẩn ô nhập từ khóa, giữ nút bộ lọc (cùng popover, cùng badge số bộ lọc); không gửi từ khóa lấy từ preset, bookmark hay URL; preset giữ nguyên; bộ lọc vẫn áp dụng. Import, Export: khi bo_show_import tắt, mục Import/Export của detail panel không có phần import (chọn file, chạy nền, nút Import); khi bo_show_export tắt, không có nút Export và link tải CSV của trang hiện tại; cả hai tắt thì không có mục. Chỉ là giao diện: API search, export, /utils/import, /utils/export không đổi, quyền vẫn do permission. Phạm vi: chỉ trang collection của Content; DrawerCollection, module khác và Directus app không đổi. Migration riêng: thư mục riêng apps/api/src/database/backoffice-migrations (không chung 101 migration port từ Directus), trạng thái trong bảng hệ thống backoffice_migrations cùng dạng directus_migrations; không ghi directus_migrations. bootstrap tạo bảng nếu chưa có rồi chạy migration riêng còn thiếu, trên mọi vendor, sau khi migration Directus đã đủ, dưới lock dùng chung (Redis khi có cấu hình) để nhiều replica khởi động cùng lúc chỉ một process chạy; migration Directus chưa đủ thì không chạy. Mỗi migration chỉ có up, chỉ dùng knex, chạy được trên 7 vendor, chạy lại được; không có down, không có lệnh CLI riêng. Lúc start, migration riêng thiếu hoặc lạ thì dừng và báo rõ. Backoffice coi backoffice_migrations là collection hệ thống như directus_migrations (danh sách collection hệ thống của API, ẩn, không truy cập qua /items, nhóm hệ thống ở Data Model, không vào snapshot). Migration đầu tiên 20261026A thêm ba cột và ba dòng directus_fields. Chạy song song: Directus 11.17.4 trên cùng DB không cần file, biến môi trường hay cấu hình mới; khởi động, đăng nhập, đọc ghi collection, snapshot/diff/apply, migrate:latest|up|down như trước; GET /collections và GET /fields/directus_collections của hai app giống nhau trừ backoffice_migrations (Directus trả meta null); Directus thấy ba cột (ba toggle không có tác dụng ở Content của Directus app) và bảng backoffice_migrations trong danh sách bảng chưa quản lý. Ghi thành khác biệt D-179 (giao diện Content), D-180 (migration riêng), D-181 (backoffice_migrations là collection hệ thống). Test: unit cho ẩn hiện và bộ chạy migration; E2E Content ba cấu hình với admin và user thường; profile bootstrap chạy migration, chạy lại, ba replica cùng lúc, so dump với Directus bỏ qua backoffice_migrations, cột bo_* và dòng directus_fields của chúng; bộ đối chiếu, blackbox collections/fields/schema trên DB đã migrate; vendor khác chạy hằng đêm.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Bỏ qua được: 10 câu đã chốt với chủ dự án ngày 2026-10-26.
```

**3. `/speckit.plan`** (sau bước này, chủ dự án duyệt các khác biệt D-xxx)

```text
/speckit.plan Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Phần chung BE: Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Phần chung FE: Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 022 có cả BE và FE. BE: bộ chạy migration riêng là file mới apps/api/src/database/backoffice-migrations/index.ts (danh sách import tĩnh, không readdir) và run.ts (chỉ latest trên backoffice_migrations, tạo bảng nếu chưa có, chạy trong useLock().usingLock('backoffice-migrations', ...) của apps/api/src/lock (redlock khi có Redis, local khi không), đọc lại bảng sau khi lấy lock, flushCaches(true) sau khi chạy như run.ts của Directus); không sửa migrations/run.ts và 101 file port (port.test.ts giữ nguyên); không thêm lệnh CLI. Nối vào cli/commands/bootstrap/index.ts (cuối nhánh Postgres/SQLite, và nhánh vendor D-145 khi migrationsValid), database/validate-migrations.ts (kiểm tra thêm backoffice_migrations: thiếu hoặc lạ thì dừng). backoffice_migrations là collection hệ thống: thêm vào libs/system-data/src/collections/collections.yaml (hidden) và sửa isSystemCollection của libs/system-data (đang chỉ nhận tiền tố directus_) và của apps/web/src/stores/collections.ts. Migration 20261026A: hasColumn trước khi thêm cột, kiểm tra dòng directus_fields trước khi insert. FE: prop showSearch cho components/SearchInput.vue (giống showFilter: ẩn nút search, input, nút xóa; pill w-11; activate không mở khi tắt); prop showImport, showExport cho components/sidebar/ExportSidebarDetail.vue (phần import đang ở v-if="createAllowed", phần export gồm nút Export và link CSV); modules/content/routes/CollectionRoute.vue đọc meta.bo_show_search, meta.bo_show_import, meta.bo_show_export (!== false), activeSearch thay search cho layout wrapper và ExportSidebarDetail, v-if="showImport || showExport" cho ExportSidebarDetail. Test: dump của profile bootstrap (tests/parity/src/bootstrap) và cli.test.ts bỏ qua phần của Backoffice; bộ đối chiếu collections bỏ qua backoffice_migrations; test migration chạy trên SQLite in-memory.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. requirements: kiểm yêu cầu migration riêng và ba toggle
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Xếp task theo 3 lượt commit: Lượt 1 = Phase 1 đến 4; Lượt 2 = Phase 5, 6; Lượt 3 = Phase 7. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E hiện có + mới xanh, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Lượt 1 (Phase 1 đến 4). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Lượt 2 (Phase 5, 6). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=022-collection-ui-toggles khi chạy script .specify. Lượt 3 (Phase 7). Test xanh, graphify update ., commit lên main theo Conventional Commits, xem CI.
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

### 023: Filter theo path trong field json

Trạng thái: đã xong 2026-10-27. Ba lượt trên `main` (`7412cb45`..`9033b7d7`), 57/58 task, CI 40404290750 và 40423967360 xanh, benchmark-items 40423999222 và benchmark-web 40415449804 xanh; D-184..D-187 đã duyệt (C1: form path + kiểu ghép từ recipe Q-7, Input, Select). T055 (nightly MariaDB, MSSQL, Oracle, CockroachDB, postgres10) chưa chạy: chủ dự án quyết định. Kết quả từng lượt ở `research.md` "Kết quả lượt 1/2/3". Thư mục: `specs/023-json-path-filter/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature lõi".

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/023-json-path-filter và đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Feature 023: filter theo path trong field json (json-path-filter). Bối cảnh: field kiểu json (cột json hoặc jsonb) hiện chỉ filter được _null/_nnull. API trả 400 "Invalid filter key" cho key json(field, path) trong filter; FieldList có mục "functions.json" nhưng gửi json(field) không có path nên cũng 400. Directus 11.17.4 giống vậy. Ví dụ: field transaction_data = {"Amount": 6000, "ApprovalCode": "940172", "Currency": "VND", "GatewayCode": "00", "GatewayID": "7051273", "RefCode": "0fb07794-..."}; người dùng cần lọc item có Amount = 6000. Mục tiêu: lọc item theo giá trị tại một path trong field json; field vẫn là json, schema và dữ liệu không đổi, chạy song song với Directus. Phạm vi: REST /items và mọi chỗ dùng chung query (export theo filter hiện tại) nhận key json(field, path), path cùng cú pháp với json() của fields: Amount, a.b, items[0].sku; thêm [*] nghĩa là khớp khi một phần tử bất kỳ của mảng khớp (VD items[*].sku). Người dùng chọn kiểu giá trị tại path: Text, Number, Boolean; toán tử theo kiểu (Text như string, Number như integer/float, Boolean như boolean). Dòng không có path hoặc giá trị khác kiểu thì không khớp, không làm lỗi cả query. Kiểu nằm trong query để bookmark giữ được. Field json ở collection hiện tại và qua quan hệ m2o. GraphQL /graphql có filter tương đương. Vendor: Postgres (cột json và jsonb) và SQLite; MySQL/MariaDB, MSSQL, Oracle, CockroachDB trả 400 với thông báo rõ. Quyền: kiểm quyền đọc trên field gốc như filter thường; path chỉ đi qua binding, không ghép chuỗi SQL. UI: filter của trang Content (sidebar filter, bookmark/preset) và DrawerCollection: khi chọn hàm json của field json thì gõ path và chọn kiểu; nhãn functions.json có en-US và vi-VN. Mọi chỗ khác dùng filter (permission/policy, flow, insights, validation của field) không hiện hàm json; API từ chối json path trong filter của permission. Khác biệt với Directus, chủ dự án đã chấp nhận ngày 2026-10-27, ghi từ D-184: 1. Bookmark/preset có json path lưu vào directus_presets dùng chung; Directus app mở bookmark đó bị lỗi 400: chấp nhận. 2. Chỉ dùng trong filter của Content và drawer chọn item. 3. Với request có json path, Directus trả 400 còn Backoffice trả 200; parity suite ghi nhận khác biệt này, mọi request khác vẫn phải giống Directus, kể cả GraphQL introspection/SDL. 4. Chỉ cần API Backoffice hỗ trợ: ở chế độ shared-domain (compose api_pool, Helm Service -api) pool có cả Directus nên request có json path rơi vào Directus sẽ nhận 400; không thêm định tuyến ở lb. Ngoài phạm vi: tự tạo index; search trong json; aggregate/groupBy theo path; MySQL, MSSQL, Oracle, CockroachDB.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Tập trung vào: cú pháp mang kiểu giá trị trong query (VD json(field, path, number) hay cách khác) dùng chung cho REST, GraphQL và bookmark; ngữ nghĩa [*] với _neq, _nin, _null (một phần tử khớp hay mọi phần tử); Text có phân biệt hoa thường không; Number có khớp chuỗi số "6000" không; API có chặn json path trong filter của flow condition và validation của field không; input GraphQL mới ảnh hưởng introspection parity thế nào.
```

**3. `/speckit.plan`** (sau bước này, chủ dự án duyệt các khác biệt D-xxx)

```text
/speckit.plan Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Phần chung BE: Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Phần chung FE: Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 023 có cả BE và FE, không thêm dependency. API: parse-filter-key.ts, get-filter-type.ts, filter/operator.ts (key.split('.') hỏng với path có dấu chấm), filter/index.ts (m2o qua getColumnPath), helpers/fn/json và dialects postgres.ts (json và jsonb, ->> và ép kiểu an toàn theo json_typeof/jsonb_typeof, json_array_elements cho [*]) và sqlite.ts (json_extract, json_type, json_each cho [*]); dialect khác ném InvalidQueryError; permissions extract-fields-from-query.ts kiểm quyền trên field gốc; filter input của GraphQL và normalizer parity cho introspection/SDL. Web: FieldList.vue gõ path và chọn kiểu khi chọn hàm json, chỉ bật bằng prop; filter của Content và DrawerCollection bật prop đó; nhãn functions.json en-US/vi-VN ngoài script sync. Test: unit API cho Postgres và SQLite, parity tests/parity/src/items ghi khác biệt D-184+, blackbox json-fields giữ nguyên, E2E filter Content trong ba cấu hình, benchmark 10 triệu dòng có và không có expression index. Ghi D-184+ vào spec và migration-guide.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. api-compat: kiểm khác biệt D-184+ có ghi đủ, request không có json path vẫn giống Directus, quyền trên field gốc, path chỉ qua binding, Postgres và SQLite
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Chia ba lượt như 020–022: lượt 1 API REST (Postgres, SQLite, m2o, [*], quyền, chặn json path trong permission) với unit và parity; lượt 2 Web (FieldList, Content, DrawerCollection, nhãn) với E2E; lượt 3 GraphQL, parity introspection, benchmark, tài liệu. Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Lượt 1: API REST (Postgres, SQLite, m2o, [*], quyền, chặn json path trong permission) với unit và parity. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Lượt 2: Web (FieldList, Content, DrawerCollection, nhãn) với E2E. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=023-json-path-filter khi chạy script .specify. Lượt 3: GraphQL, parity introspection, benchmark, tài liệu. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Quyết định của owner (2026-10-27):

| Câu hỏi                          | Chốt                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Kiểu field                       | Giữ `json`, không đổi schema hay dữ liệu                                          |
| DB vendor                        | Postgres và SQLite; vendor khác trả 400                                           |
| Kiểu giá trị tại path            | Người dùng chọn trong UI: Text, Number, Boolean                                   |
| Nhập path                        | Gõ tay, cùng cú pháp với `json(field, path)` của `fields`                         |
| Phạm vi thêm                     | Field json qua m2o, phần tử bất kỳ của mảng `[*]`, GraphQL, DrawerCollection      |
| Bookmark mở trên Directus app    | Lỗi 400, chấp nhận                                                                |
| Chỗ dùng filter json             | Chỉ filter của Content (và drawer chọn item)                                      |
| Khác biệt parity                 | Đồng ý ghi thành khác biệt D-184+                                                 |
| Định tuyến lb chế độ shared-domain | Không thêm; API Backoffice hỗ trợ là đủ, request rơi vào Directus nhận 400      |

Không sửa constitution: Nguyên tắc III cho phép khác biệt API khi đã ghi theo Nguyên tắc X (ghi trong spec, nêu lý do,
tech lead duyệt).

Ghi chú đưa vào spec và plan 023 (đọc code ngày 2026-10-27; SQL thử bằng test tạm với Knex `pg`, chưa chạy trên DB
thật):

- Field `json` trên Postgres tạo cột `json`, không phải `jsonb` (`table.json()` ở
  `apps/api/src/services/fields.service.ts:955`); cột `jsonb` tạo tay vẫn đọc là field `json`
  (`apps/api/src/schema/get-local-type.ts:73`).
- Filter `json(metadata, color)` trả 400 `Invalid filter key`: `parseFilterKey` lấy tên field là `"metadata, color"`
  (`apps/api/src/utils/parse-filter-key.ts`, giống hệt Directus). Field json chỉ có toán tử `null`, `nnull`
  (`getFilterOperatorsForType`).
- Sort theo `json()` đã chạy: `order by "products"."metadata"::json->$1 desc` (`::jsonb` với cột jsonb). `fields=json(...)`
  có blackbox `json-fields`.
- UI: `FieldList.vue` hiện mục `functions.json` vì `getFunctionsForType('json')` = `['count', 'json']`, gửi `json(field)`
  không có path, API trả 400 `requires json(field, path) format`
  (`apps/api/src/database/helpers/fn/json/parse-function.ts:48`). Directus app giống vậy (`VFieldListItem.vue:45`); en-US
  của Directus thiếu `functions.json`. `getOutputTypeForFunction('json')` = `undefined` nên UI hiện danh sách toán tử mặc
  định.
- `apps/api/src/database/run-ast/lib/apply-query/filter/operator.ts:35` tách key bằng `split('.')`, hỏng với path có dấu
  chấm.
- Kiểu `json` của Postgres không có toán tử `=`: so sánh phải dùng `->>` rồi ép kiểu; Number cần ép an toàn theo
  `json_typeof`/`jsonb_typeof` để một dòng không phải số không làm lỗi cả query.
- Hàm `json()` đã có cho postgres (cả cockroachdb, redshift), mysql, sqlite, mssql, oracle
  (`apps/api/src/database/helpers/fn/dialects/*.ts`).
- Lb: `deploy/compose/lb/shared-domain.conf` có `directus:8055` và `backoffice-api` trong `api_pool`; Helm Service `-api`
  chọn pod theo label pool dùng chung. Chế độ separate-domain chỉ có Backoffice.
- Hiệu năng [Inference]: `->>` không dùng index thường; expression index (VD `((transaction_data->>'Amount'))`) tạo tay.

### 024: API chặn tìm kiếm, Import, Export theo cài đặt collection

Trạng thái: đã xong 2026-10-27. Hai lượt trên `main` (`48b6f82f`..`10556348`), 44/44 task, CI 40534561817 xanh,
benchmark-items 40534659010, benchmark-graphql 40534690242 và benchmark-web 40541712241 xanh; D-188..D-188.4 đã duyệt.
Kết quả từng lượt ở `research.md` "Kết quả lượt 1", "Kết quả benchmark".
Mở rộng 022: tắt `bo_show_search`, `bo_show_import`, `bo_show_export` thì API Backoffice cũng chặn,
không chỉ ẩn giao diện. Sửa FR-008 ("chỉ là giao diện") và FR-009 (DrawerCollection) của 022. Thư mục:
`specs/024-collection-toggles-api/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

Không có bước 0: không sửa constitution. Nguyên tắc III cho phép khác biệt API khi đã ghi theo Nguyên tắc X (ghi trong
spec, nêu lý do, tech lead duyệt), như 023. Không thêm cột, không thêm migration: dùng ba cột của migration 20261026A.

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/024-collection-toggles-api và đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. Feature 024: mở rộng 022, API Backoffice chặn tìm kiếm, import, export theo ba cài đặt của collection. Bối cảnh: 022 thêm bo_show_search, bo_show_import, bo_show_export vào directus_collections (migration 20261026A) nhưng chỉ ẩn giao diện trang Content; FR-008 của 022 giữ API như Directus nên người dùng có quyền vẫn gọi thẳng API được. Mục tiêu: tắt cài đặt nào thì API Backoffice chặn phần đó trên collection đó; spec này sửa FR-008 và FR-009 của 022. Chặn: bo_show_search tắt thì chặn tham số search của GET và SEARCH /items/:collection (kể cả search trong body của SEARCH và khi có aggregate, groupBy) và đối số search của query items, aggregated trên /graphql; bo_show_export tắt thì chặn ?export= (mọi định dạng) trên /items/:collection và /items/:collection/:pk, và POST /utils/export/:collection; bo_show_import tắt thì chặn POST /utils/import/:collection. Lỗi: 403 FORBIDDEN như ForbiddenError hiện có (REST trả {errors}, GraphQL trả lỗi trong errors, schema GraphQL không đổi). Áp dụng cho mọi người dùng, kể cả admin, share và public. null hoặc chưa có cột thì hiểu là bật (FR-007 của 022). Giữ nhãn ba toggle; spec ghi rõ tắt toggle là ẩn giao diện và chặn API. Chỉ chặn ở lớp HTTP (controller REST, resolver GraphQL): flow, extension và service nội bộ (ItemsService, ImportService, ExportService) không bị chặn, file port giữ nguyên văn. Collection hệ thống không đổi. Web: DrawerCollection theo bo_show_search như trang Content (ẩn ô nhập từ khóa, giữ nút bộ lọc, không gửi từ khóa lấy từ preset), sửa FR-009 của 022. Chạy song song: không sửa directus/; Directus 11.17.4 cùng DB không đổi hành vi. Khác biệt với Directus, chủ dự án đã chấp nhận ngày 2026-10-27, ghi từ D-188: 1. Request bị chặn: Directus trả 200, Backoffice trả 403; mọi request khác vẫn phải giống Directus, kể cả GraphQL introspection/SDL. 2. Ở chế độ shared-domain (compose api_pool, Helm Service -api) pool có cả Directus nên request rơi vào Directus không bị chặn: chấp nhận như 023, không thêm định tuyến ở lb; chặn đủ ở standalone và separate-domain. 3. Directus app ở cấu hình proxy tới API mới: tìm kiếm, import, export của collection đã tắt nhận 403. 4. DrawerCollection theo cài đặt tìm kiếm. Response cache dùng chung với Directus không được trả response đã cache cho request bị chặn. Test: unit API cho từng route; parity items, utils, graphql ghi khác biệt D-188, request khi toggle bật vẫn giống Directus; E2E Content và DrawerCollection ba cấu hình với admin và user thường; đảo bước API của apps/web-e2e/src/content-collection-toggles.spec.ts (đang chờ 200 theo FR-008 của 022).
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. Bỏ qua được: 8 câu đã chốt với chủ dự án ngày 2026-10-27 (7 câu trước specify, FR-017 khi specify); search rỗng, GraphQL nhiều field, bookmark trong drawer, câu thông báo 403 đã ghi ở Edge Cases, FR-006. Tập trung vào: thời điểm cài đặt có tác dụng trên mọi replica khi Directus app đổi (FR-013); share và public có quyền đọc collection tắt cài đặt; mutation GraphQL có đối số search.
```

**3. `/speckit.plan`** (sau bước này, chủ dự án duyệt các khác biệt D-xxx)

```text
/speckit.plan Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. Phần chung BE: Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Phần chung FE: Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 024 có cả BE và FE, không thêm dependency, không thêm migration. API: một hàm dùng chung đọc ba cài đặt của collection từ cache hệ thống dùng chung, xóa theo schemaChanged (FR-013; SchemaOverview không có ba cột này, directus/api/src/utils/get-schema.ts:129-131, nên không thêm vào SchemaOverview đang chia sẻ với Directus qua Redis mà đọc riêng, ví dụ cache key riêng trong systemCache hoặc đọc directus_collections qua CollectionsService meta); mutation GraphQL có search từ chối trước khi ghi; kiểm tra chạy trước checkCacheMiddleware (apps/api/src/app-pipeline.ts:167, response cache dùng chung với Directus) hoặc research chứng minh cache không trả response cho request bị chặn; điểm chặn: items.controller.ts (SEARCH, GET :collection, GET :collection/:pk với export), middleware/respond.ts (export), utils.controller.ts (import/:collection, export/:collection), resolver GraphQL cho đối số search (services/graphql/schema/read.ts:673, :702, :799) không đổi schema. Không sửa ItemsService, ImportService, ExportService. Web: DrawerCollection.vue (apps/web/src/components/drawers/DrawerCollection.vue:204) truyền show-search cho SearchInput theo meta.bo_show_search !== false và dùng activeSearch như CollectionRoute.vue; kiểm tra DrawerCollection của directus-shim; list-o2m và list-m2m (ListO2M.vue:68, :163; ListM2M.vue; use-relation-multiple.ts:407, :486) ẩn ô search của enableSearchFilter khi collection liên quan tắt bo_show_search. Test: unit controller và resolver; parity tests/parity/src/items, utils, graphql với entry http D-188 như D-184; E2E đảo bước API của content-collection-toggles.spec.ts, thêm bước DrawerCollection. Ghi D-188+ vào spec và migration-guide; ghi chú "sửa bởi 024" ở FR-008, FR-009 của spec 022.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. api-compat: kiểm khác biệt D-188+ có ghi đủ, request khi toggle bật vẫn giống Directus, mọi đường vào search/import/export đều chặn, response cache không lọt, flow và extension không bị chặn
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. Chia hai lượt: lượt 1 API (REST, GraphQL, response cache, unit, parity D-188); lượt 2 Web (DrawerCollection, list-o2m, list-m2m), E2E ba cấu hình, tài liệu (spec 022, migration-guide, CLAUDE.md). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. Lượt 1: API (REST, GraphQL, response cache) với unit và parity D-188. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=024-collection-toggles-api khi chạy script .specify. Lượt 2: Web (DrawerCollection), E2E ba cấu hình, tài liệu. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Quyết định của owner (2026-10-27):

| Câu hỏi                            | Chốt                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| Định tuyến lb chế độ shared-domain | Không thêm, như 023; request rơi vào Directus không bị chặn, ghi giới hạn vào spec        |
| DrawerCollection                   | Theo `bo_show_search` như trang Content (sửa FR-009 của 022)                              |
| Admin                              | Bị chặn như mọi người (như FR-006 của 022)                                                |
| Mã lỗi                             | 403 `FORBIDDEN`                                                                           |
| Lớp chặn                           | Chỉ HTTP (controller REST, resolver GraphQL); flow, extension, service nội bộ không chặn  |
| GraphQL                            | Chặn đối số `search` trên `/graphql`, schema không đổi                                    |
| Nhãn ba toggle                     | Giữ nguyên, không thêm migration                                                          |
| Đường tìm kiếm khác (specify)      | Chặn mọi đường: `GET :id`, `PATCH`/`DELETE` theo query, `deep._search`, GraphQL quan hệ, body query của `/utils/export` (FR-017) |
| Mutation GraphQL có `search` (clarify) | Từ chối trước khi ghi, không tạo/sửa item (FR-017)                                     |
| `list-o2m`, `list-m2m` "Search Filter" (clarify) | Ẩn ô nhập từ khóa theo cài đặt của collection liên quan, giữ bộ lọc (FR-014)  |
| Đọc ba cài đặt ở API (clarify)     | Từ cache hệ thống dùng chung, xóa theo `schemaChanged`; sửa SQL thì xóa cache (FR-013)   |

Ghi chú đưa vào spec và plan 024 (đọc code ngày 2026-10-27, chưa chạy thử):

- FR-008 của 022 có test E2E chờ 200: `apps/web-e2e/src/content-collection-toggles.spec.ts:143-157` (`?search=`,
  `?export=csv` trên `bo_content`). Lượt 1 làm đỏ bước này nếu E2E chạy với API mới; đảo trong cùng lượt hoặc tách bước
  API sang lượt 1.
- Điểm vào: `apps/api/src/controllers/items.controller.ts:77-88` (SEARCH, GET dùng chung `readHandler`),
  `apps/api/src/middleware/respond.ts:78` (export json, csv, csv_utf8, xml, yaml, chạy cho mọi route gọi `respond`),
  `apps/api/src/controllers/utils.controller.ts:121` (import) và `:169` (export), đối số `search` của GraphQL ở
  `apps/api/src/services/graphql/schema/read.ts:673`, `:702`, `:799`.
- `checkCacheMiddleware` chạy ở `apps/api/src/app-pipeline.ts:167`, trước mọi route, cho GET và `/graphql`. Key cache
  giống Directus (005), nên [Inference] response `?search=` mà Directus đã cache có thể được trả trước khi tới controller.
- SchemaOverview chỉ đọc 5 cột của `directus_collections` (`directus/api/src/utils/get-schema.ts:129-131`), nên API chưa
  có sẵn `bo_show_*` trong `req.schema`.
- Lb: `deploy/compose/lb/shared-domain.conf:12` có `directus:8055` trong `api_pool`.
- DrawerCollection: `apps/web/src/components/drawers/DrawerCollection.vue:60` lấy `search` từ `usePreset`, `:204` dùng
  `SearchInput` chưa có `show-search`.
- D-188 chưa dùng ở `specs/`, `tests/parity/src/`, `CLAUDE.md` (kiểm 2026-10-27).

### 025: Quyền Import, Export theo policy, bỏ Share khỏi giao diện

Trạng thái: đã xong 2026-10-28. Ba lượt trên `main`: API `e5e60405`, web `b26cf4eb`, lb/Ingress `c3306b34`, sửa theo CI
`624d6ef9`, `0413f03c`, `7bbe1b95`, `ba4620e2`; 79/79 task; CI 40589749926 (web, E2E ba cấu hình, deploy, deploy-k8s
xanh; parity multi chập chờn do test, phiên 021 sửa `109b39e8`); benchmark-items 40580246665 và benchmark-web
40580286006 xanh. Sửa khi implement: FR-011 cộng dồn Use custom của nhiều policy (bộ lọc `_or`, field, định dạng hợp,
vẫn trong quyền read); `backoffice_permissions` bỏ khỏi Data Model như `backoffice_migrations`; M-1 (độ tương phản ô
mờ) chờ chủ design. Trước đó: đã chạy `/speckit.specify`, `/speckit.clarify` và `/speckit.plan` 2026-10-28 (`specs/025-policy-import-export/`:
spec FR-001..FR-034, D-189..D-189.7, checklist requirements đạt; 2 câu chốt khi specify: GraphQL `permissions_me` có
`import`, `export`; web theo luật Directus khi API là Directus; 5 câu chốt khi clarify: import có dòng vi phạm thì từ
chối cả file; export xin field ngoài giới hạn như read của Directus; `options` bản đầu chỉ có định dạng; public và share
cùng quy tắc; "Download Page as CSV" theo quyền export, không áp Use custom; plan: research R1–R14, data-model,
contracts api/web/tests, quickstart; D-189..D-189.7, path `/backoffice/permissions` và R1–R10 duyệt 2026-10-28, chủ dự
án kiêm tech lead; `/speckit.tasks` 2026-10-28: 79 task, ba lượt: API T001–T045, Web T046–T070, deploy và tài liệu
T071–T079; `/speckit.analyze` 2026-10-28: 0 CRITICAL, 3 HIGH, 6 MEDIUM đã áp: `SEARCH` có `export` trong body kiểm ở
controller, import vào collection hệ thống chỉ admin như Directus, sửa E2E hiện có lên lượt 1; còn 4 mục LOW;
`/speckit.checklist` api-compat 2026-10-28: 37 mục, 12 phát hiện đã sửa: kiểm export của `SEARCH` ở `validate-batch.ts`
cho mọi route, FR-035 mới (request khác giống Directus), D-189.1 thêm export có Use custom và Directus app ở proxy-api). Soạn 2026-10-28 từ các quyết định của owner (bảng cuối mục). Import và export thành hai action
cùng cấp create, read, update, delete trong ma trận quyền của policy, lưu ở bảng riêng `backoffice_permissions`;
Backoffice bỏ share khỏi giao diện (cột share của ma trận, mục Shares ở trang item, trang `/shared/:id`). Thư mục:
`specs/025-policy-import-export/`. Làm trên: `main`, không tạo branch. Model: mục 8, cột "feature còn lại".

Không có bước 0: không sửa constitution. Nguyên tắc II (3.2.0) cho phép migration riêng tạo bảng `backoffice_*`. Nguyên
tắc III và VI cho phép khác biệt API và giao diện khi đã ghi theo Nguyên tắc X (ghi trong spec, nêu lý do, tech lead
duyệt), như 023, 024 và D-130.

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/025-policy-import-export và đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Feature 025: quyền import và export theo policy, hai action mới cùng cấp create, read, update, delete; Backoffice bỏ share khỏi giao diện. Bối cảnh: Directus 11.17.4 có 5 action (create, read, update, delete, share); export chỉ cần read, import cần create và update; 022 và 024 có toggle bo_show_import, bo_show_export theo collection, áp cho mọi người kể cả admin. Mục tiêu: admin cấp hoặc không cấp import, export cho từng policy trên từng collection, như các action khác. Lưu trữ: bảng hệ thống mới backoffice_permissions tạo bằng migration riêng của Backoffice (Nguyên tắc II 3.2.0, runner backoffice_migrations của 022), cùng dạng cột với directus_permissions (policy, collection, action, permissions, validation, presets, fields) và thêm options (json) cho cấu hình riêng của từng action; không có khóa ngoại tới directus_policies; action là chuỗi, để sau này thêm action khác mà không đổi schema; danh sách action và cấu hình của chúng khai báo ở một chỗ trong code. Không ghi action import, export vào directus_permissions: Directus 11.17.4 dựng sẵn 5 action rồi đọc infos[collection][action].access, nên action lạ làm GET /permissions/me trả 500 với người không phải admin (directus/api/src/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.ts:50, đọc code, chưa chạy). Không seed dữ liệu: sau khi cài, người không phải admin không có import, export cho tới khi admin phân quyền lại. Phạm vi: mọi collection, kể cả collection hệ thống (Users, Files, Presets, Translations, export và import dashboard ở Insights); admin luôn có import, export; import cần import + create + update (giữ kiểm tra hiện có của ImportService); nhiều policy thì một policy cho phép là được, như Directus. Use custom cho import và export: bộ lọc dòng (export: dòng được xuất, AND với bộ lọc của read; import: dòng được ghi), giới hạn field (export: giao với field của read; import: cột được có trong file), định dạng file (export: csv, csv_utf8, json, xml, yaml; import: csv, json). Chặn ở ba điểm của 024: ?export= (guard trước response cache), POST /utils/export/:collection, POST /utils/import/:collection; lỗi 403 FORBIDDEN như 024. Thứ tự: toggle 024 tắt thì chặn mọi người; toggle bật thì xét quyền theo policy. GET /permissions/me thêm import và export cho mỗi collection, cùng dạng các action khác; web lấy quyền import, export từ đây và ghép với toggle 024. Ghi quyền qua endpoint riêng của Backoffice; ai sửa được directus_permissions thì sửa được; có activity và revisions; xóa policy hoặc collection qua Backoffice thì xóa dòng liên quan; dòng mồ côi (policy hoặc collection bị xóa qua Directus) bỏ qua khi đọc; nhân bản policy chép cả quyền import, export. Web, ma trận quyền của policy: 6 cột create, read, update, delete, import, export; bỏ cột share (không đổi PERMISSION_ACTIONS của libs/constants, không đụng dòng share đã có, nút All access và No access của hàng không xóa dòng share); vẫn hiện hàng directus_shares; nút All access và No access của hàng gồm cả import, export; ô import, export của collection tắt toggle 024 hiện mờ có ghi chú, vẫn lưu được; drawer Use custom của import, export có bộ lọc dòng, field, định dạng. Bỏ share khỏi giao diện: bỏ mục Shares ở trang item và route /shared/:id, không làm trang thay thế (link cũ rơi vào trang not found); API /shares và đăng nhập bằng share giữ như Directus. Chạy song song: không sửa directus/; Directus 11.17.4 cùng DB không đổi hành vi; Directus thấy backoffice_permissions là bảng chưa quản lý, như backoffice_migrations (D-181). Khác biệt với Directus, chủ dự án đã chấp nhận ngày 2026-10-28, ghi từ D-189: 1. GET /permissions/me có thêm import, export. 2. Import, export bị từ chối theo policy: Directus trả 200, Backoffice trả 403. 3. Response cache dùng chung: /permissions/me vẫn đọc và ghi cache như Directus; khi chạy cùng Directus, chấp nhận Backoffice có thể trả bản Directus đã cache (không có import, export) và ngược lại. 4. Ở shared-domain, request import, export rơi vào Directus không bị chặn, như 023 và 024. 5. Lb và Ingress đưa /permissions/me và endpoint ghi quyền mới về Backoffice, như /extensions/sources/ của 020. 6. Giao diện không còn share. 7. GET /collections khác Directus ở backoffice_permissions. Test: unit API (migration, service, ba điểm chặn, Use custom, /permissions/me); parity ghi khác biệt D-189+, mọi request khác vẫn giống Directus; E2E ba cấu hình cho ma trận quyền, import và export ở Content, Users, Files, Insights, phần share đã bỏ; deploy test cho định tuyến lb.
```

**2. `/speckit.clarify`**

```text
/speckit.clarify Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Bỏ qua được: các câu đã chốt với chủ dự án ngày 2026-10-28 (bảng quyết định của 025 trong SPECKIT-GUIDE.md, Clarifications của spec, gồm GraphQL permissions_me và luật Directus khi API là Directus). Tập trung vào các Assumptions: một dòng trong file import không thỏa bộ lọc dòng thì từ chối cả file (như lỗi validation hiện có, import chạy trong transaction) hay bỏ dòng đó; export yêu cầu field ngoài giới hạn thì trả 403 như read của Directus hay bỏ field; ngoài định dạng file, bản đầu có cấu hình nào khác (ví dụ số dòng tối đa); share và public có import, export không.
```

**3. `/speckit.plan`** (sau bước này, chủ dự án duyệt các khác biệt D-xxx)

```text
/speckit.plan Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Phần chung BE: Node 22, pnpm 10, Nx monorepo, apps/api là NestJS (TypeScript strict), truy cập DB bằng Knex với các dialect như directus/api/src/database/helpers, cache và bus bằng Redis (ioredis) theo đúng key và kênh của Directus, validate bằng Joi hoặc Zod giống directus/packages/validation. Port logic từ file tương ứng trong directus/api/src, ghi đường dẫn file gốc ở đầu file. Thư viện nội bộ đặt tên @backoffice/*. Cấu hình đọc bằng thư viện env port từ directus/packages/env, không đổi tên biến. Mỗi service Directus thành một provider NestJS, controller mỏng. Test: Vitest cho unit, test đối chiếu chạy cùng request với Directus 11.17.4 thật và API mới (copy từ directus/tests/blackbox), Docker Compose cho Postgres, MySQL, SQLite và Redis. CI trên GitHub Actions, coverage BE tối thiểu 80%. Phần chung FE: Node 22, pnpm 10, Nx monorepo, apps/web là Vue 3 (Composition API, script setup, TypeScript strict), Vite, Pinia, Vue Router, Reka UI 2.8.2 (headless, MIT, cùng bản Directus app) + Tailwind CSS 4.3 (style và bố cục khung theo design-system/ dựa trên TailAdmin: theme design-system/tokens/theme.css chép bằng @theme, dùng tên brand-*, gray-*, success-*..., không dùng hex thô hay màu palette ngoài theme; bố cục theo docs/layout-patterns.md, component theo docs/component-specs.md; theme là mặc định, settings áp lên trên như directus/app/src/app.vue: project_color vào --project-color cho logo, trang public/share, favicon, theme_light_overrides/theme_dark_overrides đè biến theme có ánh xạ), vue-i18n dùng file dịch copy từ directus/app/src/lang (đổi chữ Directus thành Backoffice), gọi API bằng @directus/sdk. Được copy composable hoặc utils từ directus/app/src khi cần, nhưng viết lại component bằng Reka UI. Test: Vitest + Vue Test Utils cho component, Playwright cho luồng E2E chạy với cả Directus thật và API mới. CI trên GitHub Actions, coverage FE tối thiểu 60%. Feature 025 có BE, FE và deploy, không thêm dependency. Migration: migration riêng thứ hai trong apps/api/src/database/backoffice-migrations (thêm vào BACKOFFICE_MIGRATIONS ở index.ts:15; chạy lại được và an toàn khi nhiều process cùng chạy như 20261026A) tạo backoffice_permissions, kiểu cột chạy được trên 7 vendor (policy cùng kiểu directus_permissions.policy, không khóa ngoại). backoffice_permissions là collection hệ thống của Backoffice như backoffice_migrations (libs/system-data/src/collections/collections.yaml:129, isSystemCollection; apps/api/src/services/graphql/schema/index.ts:50 nếu không đưa vào GraphQL). Service kế thừa ItemsService như PermissionsService (clearSystemCache khi ghi, xóa response cache theo CACHE_AUTO_PURGE như Directus, activity và revisions); endpoint riêng: plan đề xuất path (nên có một tiền tố chung cho endpoint riêng của Backoffice), chủ dự án duyệt theo D-code. Kiểm tra quyền: một hàm trong apps/api/src/permissions/modules/ dùng fetchPolicies, đọc dòng backoffice_permissions của các policy (có cache, xóa theo schemaChanged), gọi ở middleware/collection-toggles-guard.ts (?export=, trước checkCacheMiddleware), controllers/utils.controller.ts:127 (import) và :177 (export), sau assertToggle của 024; áp bộ lọc dòng và field vào query export (AND với read) và vào import (kiểm từng dòng; giữ kiểm tra create, update ở services/import-export.service.ts:228, :240); kiểm định dạng (import-export.service.ts:253 cho mime import, :840-888 cho định dạng export). /permissions/me: thêm import, export trong fetch-accountability-collection-access.ts của Backoffice (admin full), không đổi PERMISSION_ACTIONS ở libs/constants/src/permissions.ts:2, response cache giữ nguyên. Xóa collection (services/collections.service.ts:711 đang xóa directus_permissions) và xóa policy qua Backoffice thì xóa dòng backoffice_permissions. Web: app-permissions.ts:12 (editablePermissionActions) bỏ share, thêm import, export; PermissionsRow.vue:51 và SystemPermissions.vue (getPermission :79, setFullAccess, setNoAccess :147-186) đọc và ghi hai nguồn (o2m permissions của policy và backoffice_permissions), lưu backoffice_permissions sau khi lưu policy; PermissionsDetail.vue:64 thêm tab cho import, export (bộ lọc dòng, field, định dạng); routes/policies/use-duplicate.ts:32 chép thêm; use-collection-permissions.ts thêm importAllowed, exportAllowed từ /permissions/me; ExportSidebarDetail.vue:532 và các chỗ dùng (CollectionRoute.vue:141, UsersCollectionRoute.vue:344, FilesCollectionRoute.vue:610, PresetsCollectionRoute.vue:221, TranslationsCollectionRoute.vue:218, InsightsOverviewRoute.vue:126 và :294) ghép quyền với toggle 024; bỏ SharesSidebarDetail ở ItemRoute.vue:819 và route shared ở router/index.ts:91. Chuỗi en-US, vi-VN dùng khóa import, export sẵn có, thiếu thì thêm vào overlay. Deploy: deploy/compose/lb/shared-domain.conf (api_pool có Directus ở :12) thêm location cho /permissions/me và endpoint mới về bo_pool như /extensions/sources/ ở :52; Helm deploy/helm/backoffice/templates/ingress.yaml thêm path như /extensions/sources ở :32; deploy test tests/parity/src/deploy. Parity: tests/parity/src/normalizers.ts lọc bảng backoffice_* theo tiền tố (sửa chỗ lọc theo tên backoffice_migrations ở :122); /permissions/me ghi D-189 cho khóa import, export; tests/parity/src/permissions (matrix-harness.ts, matrix.ts). E2E: settings-permissions.spec.ts, settings-roles-policies.spec.ts (6 cột, Use custom, nhân bản policy), content-share.spec.ts và payload/comments-shares.spec.ts (bỏ phần giao diện share), import và export theo policy ở Content, Users, Files, Insights. Ghi D-189+ vào spec và migration-guide.
```

**4. `/speckit.checklist`** (tùy chọn)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. api-compat: khác biệt D-189+ có ghi đủ, Directus 11.17.4 cùng DB không đổi hành vi, mọi đường vào import, export đều kiểm quyền theo policy, Use custom không cho nhiều hơn read, create, update, migration chạy lại được trên 7 vendor, mọi request khác vẫn giống Directus
```

**5. `/speckit.tasks`**

```text
/speckit.tasks Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Chia ba lượt: lượt 1 API (migration, service và endpoint ghi quyền, ba điểm chặn, Use custom, /permissions/me, xóa collection và policy, unit, parity D-189+); lượt 2 Web (ma trận 6 cột, drawer Use custom, lưu và nhân bản policy, import và export ở các module, bỏ Shares và /shared/:id), E2E ba cấu hình; lượt 3 deploy (lb, Ingress, deploy test) và tài liệu (migration-guide, CLAUDE.md, SPECKIT-GUIDE.md). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test, build, E2E, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Lượt 1: API (migration backoffice_permissions, service và endpoint ghi quyền, ba điểm chặn, Use custom, /permissions/me) với unit và parity D-189+. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Lượt 2: Web (ma trận 6 cột, Use custom, import và export ở các module, bỏ Shares và /shared/:id), E2E ba cấu hình. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Lượt 3:

```text
/speckit.implement Đặt SPECIFY_FEATURE=025-policy-import-export khi chạy script .specify. Lượt 3: deploy (lb, Ingress, deploy test) và tài liệu. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa code, xem CI.
```

Quyết định của owner (2026-10-28):

| Câu hỏi                              | Chốt                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Nơi lưu quyền import, export         | Bảng riêng `backoffice_permissions`, không ghi vào `directus_permissions`                              |
| Dạng bảng                            | Như `directus_permissions` và thêm `options`; `action` là chuỗi, thêm action sau không đổi schema      |
| Khóa ngoại tới `directus_policies`   | Không có; dòng mồ côi bỏ qua khi đọc                                                                   |
| Dữ liệu có sẵn                       | Không seed; admin phân quyền lại                                                                       |
| Collection hệ thống                  | Áp dụng (Users, Files, Presets, Translations, Insights)                                                |
| Admin                                | Luôn có import, export; toggle 024 vẫn chặn                                                            |
| Quyền cần cho import                 | `import` + `create` + `update`                                                                         |
| Nhiều policy                         | Một policy cho phép là được                                                                            |
| Use custom                           | Có: bộ lọc dòng, giới hạn field, định dạng file                                                        |
| Điểm chặn                            | `?export=`, `/utils/export`, `/utils/import`                                                           |
| Thứ tự với toggle 024                | Toggle tắt thì chặn mọi người; toggle bật thì xét policy                                               |
| Web lấy quyền                        | Từ `GET /permissions/me` (thêm khóa `import`, `export`)                                                |
| Response cache của `/permissions/me` | Giữ đọc và ghi; chấp nhận lệch với Directus khi chạy chung                                             |
| Ghi quyền                            | Endpoint riêng của Backoffice; quyền sửa như `directus_permissions`; có activity, revisions            |
| Cột share trong ma trận              | Bỏ; không đụng dòng `share` cũ; All/No access không xóa dòng `share`                                   |
| Hàng `directus_shares` trong ma trận | Vẫn hiện                                                                                               |
| Ô import, export khi toggle 024 tắt  | Hiện mờ có ghi chú, vẫn lưu được                                                                       |
| Shares ở trang item và `/shared/:id` | Bỏ cả hai, không làm trang thay thế                                                                    |
| API `/shares`, đăng nhập bằng share  | Giữ như Directus                                                                                       |
| Lb, Ingress                          | `/permissions/me` và endpoint mới về Backoffice; request import, export rơi vào Directus không bị chặn |

Chốt khi `/speckit.specify` (2026-10-28): GraphQL `permissions_me` có `import`, `export` như REST; web theo luật Directus
và ẩn hai cột khi API là Directus. Chốt khi `/speckit.clarify` (2026-10-28): file import có dòng vi phạm bộ lọc hay cột
ngoài giới hạn thì từ chối cả file (FR-016); export xin rõ field ngoài giới hạn thì 403, `*` chỉ lấy field được phép
(FR-015); `options` bản đầu chỉ có định dạng file (FR-017); public và share cùng quy tắc với mọi policy (FR-011);
"Download Page as CSV" hiện theo quyền export, tạo file ở trình duyệt từ dữ liệu đã đọc, không áp Use custom (FR-028).

Ghi chú đưa vào spec và plan 025 (đọc code ngày 2026-10-28, chưa chạy thử):

- Directus không chịu action lạ trong `directus_permissions`:
  `directus/api/src/permissions/modules/fetch-accountability-collection-access/fetch-accountability-collection-access.ts:40-50`
  dựng sẵn 5 action rồi đọc `.access` của action đang duyệt. [Inference] Dòng `import` làm `GET /permissions/me` và
  `permissions_me` của `/graphql/system` trả 500 với người không phải admin.
- Snapshot của Directus bỏ bảng chưa quản lý (`directus/api/src/utils/get-snapshot.ts:27`, `excludeUntracked`), nên
  `schema apply` không xóa `backoffice_permissions`. Nếu ai đó "configure" bảng này trong Directus thì bảng vào
  snapshot.
- Khóa cache giống Directus (`apps/api/src/utils/get-cache-key.ts`: version, user, path, query). Mặc định
  `CACHE_AUTO_PURGE=false`, request có Referer từ `PUBLIC_URL/admin` bỏ bước đọc cache nhưng vẫn ghi
  (`apps/api/src/utils/should-skip-cache.ts`, `apps/api/src/middleware/respond.ts:36-45`).
- `ItemsService` xóa response cache khi ghi nếu `CACHE_AUTO_PURGE=true` (`apps/api/src/utils/should-clear-cache.ts`).
- Lb: `deploy/compose/lb/shared-domain.conf:12` có `directus:8055` trong `api_pool`, `:52` đưa `/extensions/sources/` về
  `bo_pool`; `standalone.conf` không có Directus trong pool.
- Link chia sẻ có dạng `<origin>/admin/shared/<id>` (`apps/web/src/components/sidebar/SharesSidebarDetail.vue:91`);
  `/admin/` của shared-domain đi tới Backoffice web (`shared-domain.conf:48`); route bắt mọi path là
  `apps/web/src/router/index.ts:101`.
- Định dạng: import nhận `application/json`, `text/csv`, `application/vnd.ms-excel`
  (`apps/api/src/services/import-export.service.ts:253`); export có json, xml, csv, csv_utf8, yaml (`:840-888`).
- `specs/025-*` chưa có; D-189 chưa dùng ở `specs/`, `tests/parity/src/`, `CLAUDE.md` (kiểm 2026-10-28).

### 026: Backoffice chạy cạnh Directus chỉ ở domain riêng

Trạng thái: Done 2026-10-28 (lượt 1 `4d92fa84`, CI 40649899202; lượt 2 `711912e7` + `9c51d772`, CI 40658073965; US3 kịch bản 2, 3 chưa kiểm tay vì không có môi trường chung domain). Đã chạy `/speckit.specify` 2026-10-28 (`specs/026-separate-domain-only/`: spec FR-001..FR-015,
SC-001..SC-007, US1 compose, US2 Helm, US3 chuyển từ chung domain; checklist requirements đạt; 2 câu chốt: Q1 user SAML
chỉ dùng Directus app ở domain Directus, Q2 sửa constitution) và bước 0 (constitution 3.3.0, 2026-10-28); spec 019 có
ghi chú "revised by 026"; `/speckit.clarify` 2026-10-28: 5 câu chốt Q3–Q7 (bảng cuối mục); thêm FR-015 rà soát chỗ lệch luồng Directus vì
chung domain ở spec 001–025 và code (2026-10-28); `/speckit.plan` 2026-10-28: plan.md, research.md (R1–R10, bảng FR-015 đủ: không
code nào trong apps/* lệch vì chung domain), data-model.md, contracts/{compose,helm-values,tests}.md, quickstart.md; không
Complexity Tracking; `/speckit.checklist` deploy 2026-10-28 (32 mục). `/speckit.tasks` 2026-10-28: tasks.md 29 task, hai lượt (T016, T029 đóng lượt). Còn: `/speckit.analyze`,
`/speckit.implement`. Bỏ chế độ chung domain của 019 (Directus và replica BE chung pool sau một lb): khi chạy cạnh
Directus, Backoffice chỉ ở domain riêng (US9 của 019 thành bố cục duy nhất); standalone (021) giữ nguyên. Chỉ đổi đóng
gói triển khai, không đổi code API và web, không thêm dependency. Thư mục: `specs/026-separate-domain-only/`. Làm trên:
`main`, không tạo branch. Model: mục 8, cột "feature còn lại".

Lưu ý: không stage `apps/api/project.json`, `apps/web/project.json` (thay đổi của session khác). Bước 0 chạy trước
`/speckit.plan`.

**0. `/speckit.constitution`**

Feature 026 trái với Nguyên tắc VII ("BE ... sau load balancer, cùng với các instance Directus") và VIII ("không cần
khai báo lại"; 019 chỉ có ngoại lệ T079 cho `PUBLIC_URL` ở chế độ domain riêng). Đã chạy ngày 2026-10-28 sau
`/speckit.specify` (Clarifications Q2: A): constitution 3.3.0, theo yêu cầu của chủ dự án (kiêm tech lead).

```text
/speckit.constitution MINOR 3.2.0 → 3.3.0 (spec 026, chủ dự án duyệt 2026-10-28, Q2: A). Nguyên tắc VII: khi Backoffice chạy cạnh Directus (chung DB, Redis, storage), Backoffice PHẢI ở domain riêng: Directus giữ domain, /admin, Ingress, Deployment của nó và không vào pool API của Backoffice; pool API của Backoffice chỉ gồm replica BE; FE và BE của Backoffice chung domain của Backoffice (/admin/* vào FE, path khác vào BE); bỏ ý "BE sau load balancer cùng với các instance Directus" theo nghĩa chung pool, giữ ý ngang hàng trên cùng DB và Redis. Nguyên tắc VIII: PUBLIC_URL là biến duy nhất bản Backoffice đặt riêng khi chạy cạnh Directus (ngoại lệ T079 của 019 thành quy tắc); mọi biến khác dùng nguyên .env/ConfigMap/Secret của Directus. Nguyên tắc IV: lý do "request có thể đi vào bất kỳ instance nào" sửa cho đúng: hai app dùng chung trạng thái trên DB/Redis, token dùng được ở app kia, cookie theo domain.
```

**1. `/speckit.specify`**

```text
/speckit.specify Làm trên main, không tạo branch (không chạy git checkout -b): tạo thư mục specs/026-separate-domain-only và đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. Bỏ hẳn chế độ "chung domain" của spec 019 (FR-050: một domain, /admin → FE Backoffice, các path khác → pool gồm Directus + replica BE). Khi Backoffice chạy song song với Directus (chung DB, Redis, storage), hai bản PHẢI ở hai domain riêng: Directus giữ domain, /admin, Ingress, Deployment của nó và không vào pool API; Backoffice (FE + BE nhiều replica) ở domain riêng, pool API chỉ gồm replica BE, chỉ đặt riêng PUBLIC_URL (FR-071), kiểm tra cookie domain khi cài (FR-076). Chế độ domain riêng (US9, FR-070..FR-076) trở thành chế độ duy nhất khi có Directus; chế độ standalone (021, không Directus) giữ nguyên. Thay đổi compose mặc định, lb conf, Helm (mode shared, Ingress, label apiPool, checks, kind test), bộ test tests/parity/src/deploy, CI deploy/deploy-k8s, benchmark, deploy/README; các route bo_pool của 020 (D-137 /extensions/sources) và 025 (D-189.7 /permissions/me, /backoffice/) không còn cần khi Directus không ở trong pool. Ghi rõ FR nào của 019 bị thay (FR-045 Ingress chung một domain, FR-050, Q1, câu cuối FR-070, SC liên quan) và thêm dòng "revised by 026" vào 019.
```

**2. `/speckit.clarify`** (đã chạy 2026-10-28)

```text
/speckit.clarify Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. Bỏ qua được: các câu đã chốt với chủ dự án ngày 2026-10-28 (bảng quyết định của 026 trong SPECKIT-GUIDE.md, Clarifications Q1, Q2 của spec). Tập trung vào các Assumptions: cổng compose dev (Directus 8090 có /admin của Directus, Backoffice 8091 như chế độ domain riêng đã test, hay Backoffice 8090 như standalone); giữ tên value Helm mode: shared (nghĩa "chạy cạnh Directus") hay đổi tên; values-separate-domain.yaml gộp vào values.yaml hay giữ làm ví dụ; helm upgrade release chung domain cũ: chỉ dừng và báo, hay có bước tự gỡ nhãn pool; US1 của 019 (thay image một service Directus) còn nằm trong phạm vi hỗ trợ không.
```

**3. `/speckit.plan`** (đã chạy 2026-10-28; không khác biệt D-xxx mới, không cần duyệt)

```text
/speckit.plan Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. Node 22, pnpm 10, Nx monorepo. Feature 026 không đổi code API, web, image; không thêm dependency. Compose: deploy/compose/docker-compose.yml (lb cổng 8090 với lb/shared-domain.conf: api_pool có directus:8055 và backoffice-api, bo_pool cho /extensions/sources/, /permissions/me, /backoffice/) gộp docker-compose.separate-domain.yml (PUBLIC_URL của backoffice-api và backoffice-web, lb 8091:8081, lb/separate-domain.conf: 8080 → directus, 8081 → /admin FE, còn lại pool chỉ backoffice-api) vào mặc định; xóa docker-compose.separate-domain.yml và lb/shared-domain.conf; kiểm .env.example, .env.deploy-test, docker-compose.standalone.yml, docker-compose.shared-extensions.yml, init-env.sh. Helm deploy/helm/backoffice: values.yaml (mode: shared giữ tên, apiPool bỏ, domain.publicUrl và ingress.host bắt buộc ở mode shared, extraPaths bỏ ví dụ SAML), templates api-service.yaml (selector theo nhãn của release thay backoffice.io/api-pool), api-deployment.yaml (bỏ nhãn pool), api-only-service.yaml (xóa), ingress.yaml (bỏ ba path tới -api-only, một host Backoffice), _checks.tpl (thiếu domain thì dừng; FR-076 cookie domain mọi lần ở mode shared; FR-053 giữ), _helpers.tpl (backoffice.pool), NOTES.txt, values-separate-domain.yaml (xóa, Q5); ci/deps.yaml (không có nhãn pool, Directus ở host cms.test, chỉ kiểm), ci/kind-test.sh (bỏ patch nhãn pool cho Directus ở :50 và kiểm Service bo-api-only ở :57-63; api() ở :15 gọi Backoffice qua Host cms.test → host Backoffice, Directus vẫn qua cms.test; apiPool.name ở :129, :142; kiểm Directus không đổi, pod Directus mang nhãn cũ không nhận request), ci/test-template.sh (bỏ kiểm nhãn pool :40, api-only Service :55, lượt separate :58-61; kiểm :86). Test tests/parity/src/deploy: instances.ts (SEPARATE, lbUrl, boLbUrl, composeArgs), separate-domain.test.ts, compose.test.ts, smoke, sessions, schema, flows-schedule, shutdown và tus (tải qua lb domain Backoffice), extensions, backoffice-permissions, backoffice-migrations, image-swap; kiểm standalone, web-image, instances.test, global-setup. CI .github/workflows/ci.yml job deploy (bỏ lượt DEPLOY_MODE: separate-domain, còn mặc định và standalone), deploy-k8s; benchmark.yml không dùng deploy/compose (không đổi). Tài liệu: deploy/README.md (bảng cổng ở Máy dev :82; Extensions :162-163 route /extensions/sources; Domain riêng :193-207 thành bố cục mặc định; Kubernetes: bảng value apiPool :248, đoạn "Đưa Directus vào pool" :265-267 thay bằng mục chuyển từ chung domain sang domain riêng, đoạn 023/024 :270-278 về request rơi vào Directus, SAML :294-303; Chạy độc lập :324, :362; Quyền import, export :439-440 route D-189.7; Thay image :27 theo Q7; kiểm Tắt máy an toàn); FR-015: research.md quét đủ mọi bảng "Khác biệt so với Directus" (D-xx), Edge Cases, Clarifications, Assumptions của specs/001..025 cùng comment và nhánh code xử lý "API là Directus" (apps/api, apps/web, libs), xác nhận và bổ sung bảng "Rà soát chỗ lệch luồng Directus vì chung domain" của spec (lượt đầu: chỉ định tuyến lb/Ingress của 020 FR-047, 025 FR-031/D-189.7 cần gỡ; sửa chữ ở 020 FR-040, 021 FR-083, 023 D-184, 024 D-188, 025 D-189.1, FR-034, US5; giữ 003, 004–010 E2E qua reverse proxy, 012 FR-071, 014 D-39, 024 D-188.4, 025 D-189.2); dòng "Gỡ" chạm apps/api hoặc apps/web cần chủ dự án duyệt trước; ghi chú "(026: ...)" tại chỗ ở specs/020, 021, 023, 024, 025 theo bảng (FR-014); CLAUDE.md (dòng 019, 020, 025 nhắc separate-domain override, route lb/Ingress).
```

**4. `/speckit.checklist`** (đã chạy 2026-10-28: `checklists/deploy.md`, 32 mục, 20 phát hiện sửa vào spec; CHK021 thu hẹp phần CI của US3)

```text
/speckit.checklist Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. deploy: không còn cấu hình nào đưa Directus vào pool hay domain của Backoffice, Directus không đổi Deployment/Service/Ingress, chỉ PUBLIC_URL đặt riêng, kiểm tra cookie domain và env đa instance chạy khi cài và nâng cấp, standalone không đổi, route của 020/025 vẫn do BE trả, bộ test deploy và kind phủ US1–US3, tài liệu chuyển đổi đủ bước
```

**5. `/speckit.tasks`** (đã chạy 2026-10-28; prompt thực tế thêm: đổi tên `lb/shared.conf`, override standalone đặt lại `PUBLIC_URL`, `accepted-differences.ts`, ghi chú ở spec 003, 004, 014)

```text
/speckit.tasks Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. Chia hai lượt: lượt 1 compose (gộp override domain riêng vào mặc định, xóa shared-domain.conf), bộ test tests/parity/src/deploy, job CI deploy; lượt 2 Helm (values, templates, checks, NOTES), ci/kind-test.sh, ci/test-template.sh, job deploy-k8s, tài liệu (deploy/README.md có mục chuyển đổi, ghi chú "(026: ...)" tại chỗ ở spec 020, 021, 023, 024, 025 theo bảng rà soát FR-015, CLAUDE.md, SPECKIT-GUIDE.md). Mỗi lượt kết thúc bằng task "đóng lượt" (lint, test, deploy test, commit, push, CI xanh, graphify update .).
```

**6. `/speckit.analyze`**

```text
/speckit.analyze Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify.
```

**7. `/speckit.implement`** (mỗi lượt một lần chạy)

Lượt 1:

```text
/speckit.implement Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. Lượt 1: compose mặc định domain riêng, bộ test deploy, job CI deploy. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa, xem CI.
```

Lượt 2:

```text
/speckit.implement Đặt SPECIFY_FEATURE=026-separate-domain-only khi chạy script .specify. Lượt 2: Helm chart, kind test, job deploy-k8s, tài liệu. Commit thẳng main theo Conventional Commits, chạy graphify update . sau khi sửa, xem CI.
```

Quyết định của owner (2026-10-28):

| Câu hỏi                          | Chốt                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------- |
| Chế độ chung domain của 019      | Bỏ hẳn, không giữ làm tùy chọn                                                    |
| Sửa 019 hay viết spec mới        | Spec mới 026; 019 có ghi chú "revised by 026"                                     |
| Bố cục khi chạy cạnh Directus    | Hai domain; pool API của Backoffice chỉ gồm replica BE; Directus không vào pool   |
| Biến đặt riêng cho Backoffice    | Chỉ `PUBLIC_URL`; kiểm tra cookie domain (FR-076) khi cài, nâng cấp               |
| User SAML (Q1)                   | Chỉ dùng Directus app ở domain Directus                                           |
| Constitution (Q2)                | Sửa lên 3.3.0: VII, VIII, lý do của IV                                            |
| Standalone (021)                 | Giữ nguyên                                                                        |
| Route riêng của 020 và 025       | Bỏ khỏi lb và Ingress (D-189.7 gỡ, ghi chú D-137 bỏ); BE vẫn trả các path đó     |
| Rà soát spec trước (FR-015)      | Bảng chỗ lệch luồng Directus vì chung domain: gỡ, sửa chữ, hoặc giữ kèm lý do     |

Chốt khi `/speckit.clarify` (2026-10-28): Q3 compose dev giữ Directus `8090` qua lb (Directus app ở `/admin`),
Backoffice `8091`, Directus gọi thẳng `8095`, env chung giữ `PUBLIC_URL=http://localhost:8090` (FR-005); Q4 giữ tên
`mode: shared`, ghi rõ nghĩa "chạy cạnh Directus" (FR-006); Q5 xóa `values-separate-domain.yaml`, domain bắt buộc trong
`values.yaml` (FR-006); Q6 `helm upgrade` release cũ chỉ dừng và báo khi thiếu domain, chart không sửa Deployment
Directus, tài liệu có bước tay gỡ nhãn pool (FR-006, FR-013); Q7 giữ US1 của 019 như hợp đồng của image, service đổi
image phục vụ domain Backoffice với `PUBLIC_URL` riêng (FR-013).

Ghi chú đưa vào spec và plan 026 (đọc file ngày 2026-10-28, chưa chạy thử):

- `deploy/compose/lb/shared-domain.conf:10-14`: `api_pool` có `directus:8055` và `backoffice-api`; `bo_pool` cho
  `/extensions/sources/`, `/permissions/me`, `/backoffice/`.
- `deploy/compose/lb/separate-domain.conf`: cổng 8080 → `directus:8055`; cổng 8081 → `/admin` tới FE, còn lại pool chỉ
  `backoffice-api`. Override map 8091:8081, `PUBLIC_URL` `http://localhost:8091` cho `backoffice-api`, `backoffice-web`.
- Helm: `api-service.yaml:12` và `api-deployment.yaml:25` dùng nhãn `backoffice.io/api-pool`; `ingress.yaml:35,41,45`
  đưa ba path tới Service `-api-only`; `values-separate-domain.yaml:9-10` đặt `apiPool.name: backoffice-separate` để
  không pod Directus nào khớp; `values.yaml:81` có ví dụ SAML trong `extraPaths`.
- `ci/kind-test.sh:50` gắn nhãn pool cho Deployment Directus; `:129`, `:142` đặt `apiPool.name`.
- CI `.github/workflows/ci.yml` job `deploy`: ba lượt `parity-tests:deploy` (mặc định, `separate-domain`, `standalone`).
- `.github/workflows/benchmark.yml` không dùng `deploy/compose` (chữ "shared" trong file là "shared runner").
- Backoffice không có SAML (D-24 của 003: route `404`, không có trong `GET /auth`).

---

## 7. Phần chung của `/speckit.plan`

Phần chung dưới đây đã chép vào khối `/speckit.plan` của từng feature ở mục 6. Sửa ở đây thì chép lại vào mục 6.

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
**013, 014** (FE), **020** và **023** (cả hai).

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
