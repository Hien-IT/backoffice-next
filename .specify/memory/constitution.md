<!--
Sync Impact Report (1.3.0, 2026-10-10)
- Version change: 1.2.0 → 1.3.0
- Modified sections: XI. Ngoài phạm vi giai đoạn này: "SSO bằng LDAP, OAuth2, SAML (chỉ làm OpenID Connect)" đổi
  thành "SSO bằng SAML (làm OpenID Connect, OAuth2, LDAP)". Lý do: app mới dùng chung `.env` với Directus; nếu Directus
  có provider OAuth2 hoặc LDAP mà app mới bỏ qua, request refresh của người dùng SSO rơi vào app mới sẽ lỗi và người
  dùng bị đăng xuất. Chủ dự án chọn khi clarify feature 003 (hỗ trợ đầy đủ OAuth2, LDAP ngay trong 003).
  MINOR: thu hẹp danh sách ngoài phạm vi (mở rộng phạm vi); mọi thứ hợp lệ theo 1.2.0 vẫn hợp lệ.
- Added/removed sections: không
- Templates: ✅ .specify/templates/plan-template.md (dòng XI của Constitution Check); ✅ SPECKIT-GUIDE.md (bảng tóm
  tắt và prompt nguồn của constitution); ✅ spec, tasks, checklist template không nhắc mục này.
- Deferred TODOs: không. Tech lead đã duyệt ngày 2026-10-10 (chủ dự án xác nhận; quy trình không có PR).

Sync Impact Report (1.2.0, 2026-10-10)
- Version change: 1.1.0 → 1.2.0
- Modified principles: VII. Triển khai đa instance: câu "KHÔNG dùng cache hay lock trong bộ nhớ process"
  đổi thành "KHÔNG dùng cache hay lock trong bộ nhớ process làm nguồn dữ liệu duy nhất. Cache trong process
  chỉ được phép khi được dựng lại từ DB hoặc Redis và bị xóa qua bus Redis trên mọi instance, như Directus."
  Câu tương ứng của Reviewer ở "Quy trình phát triển và cổng kiểm tra" sửa theo. Lý do: Directus 11.17.4
  giữ SchemaOverview, lớp local của permissions cache (và cache GraphQL schema) trong bộ nhớ process và xóa
  qua bus Redis; feature 002, 004, 011 cần làm giống. Chủ dự án yêu cầu khi phân tích feature 002.
  MINOR: mở rộng hướng dẫn của một nguyên tắc; mọi thứ hợp lệ theo 1.1.0 vẫn hợp lệ.
- Added/removed sections: không
- Templates: ✅ .specify/templates/plan-template.md (dòng VII của Constitution Check);
  ✅ SPECKIT-GUIDE.md (prompt nguồn của constitution); ✅ spec, tasks, checklist template không nhắc câu này.
- Deferred TODOs: không

Sync Impact Report (1.1.0, 2026-10-09)
- Version change: 1.0.0 → 1.1.0
- Modified principles: VI. Kiến trúc: thư viện UI của `apps/web` đổi từ PrimeVue sang Reka UI. Lý do: từ bản
  5.0 PrimeVue chuyển sang license thương mại PrimeUI (cần license key, bản miễn phí chỉ cho tổ chức dưới
  1 triệu USD doanh thu và dưới 5 lập trình viên). Reka UI (MIT, headless) là thư viện Directus app đang dùng
  (`reka-ui` 2.8.2), nên giữ được hành vi component như Directus, còn giao diện là style riêng của Backoffice.
  MINOR: đổi lựa chọn công nghệ trong
  nguyên tắc, chưa có code FE nào phụ thuộc PrimeVue.
- Templates: ✅ không template nào nhắc PrimeVue; ✅ SPECKIT-GUIDE.md, CLAUDE.md đã sửa theo.

Sync Impact Report (1.0.0)
- Version change: (template, chưa có) → 1.0.0
- Modified principles: không (lần ban hành đầu tiên)
- Added principles:
  I. Directus là nguồn tham chiếu, chỉ đọc
  II. Dùng chung database với Directus
  III. API giống hệt Directus
  IV. Chạy song song an toàn
  V. Kiểm thử đối chiếu là bắt buộc
  VI. Kiến trúc
  VII. Triển khai đa instance
  VIII. Kế thừa toàn bộ biến môi trường của Directus
  IX. Đổi thương hiệu Directus thành Backoffice
  X. Chất lượng, quy trình và vận hành
- Added sections: "XI. Ngoài phạm vi giai đoạn này", "Quy trình phát triển và cổng kiểm tra", "Governance"
- Removed sections: không
- Templates:
  ✅ .specify/templates/plan-template.md (Constitution Check điền cổng I–XI)
  ✅ .specify/templates/spec-template.md (thêm mục "Khác biệt so với Directus")
  ✅ .specify/templates/tasks-template.md (test là bắt buộc, thêm test đối chiếu)
  ✅ .specify/templates/checklist-template.md, agent-file-template.md (không tham chiếu nguyên tắc, không cần sửa)
  ✅ .claude/commands/speckit.tasks.md (bỏ "Tests are OPTIONAL", test là bắt buộc)
  ✅ .claude/commands/speckit.*.md còn lại (tham chiếu constitution chung, không cần sửa)
  ✅ SPECKIT-GUIDE.md (prompt nguồn của constitution, đã khớp)
- Deferred TODOs: không
-->

# Backoffice Constitution

## Core Principles

### I. Directus là nguồn tham chiếu, chỉ đọc

- KHÔNG ĐƯỢC sửa, xóa hay tạo file trong thư mục `directus/`.
- ĐƯỢC copy code từ `directus/` sang `apps/` và `libs/`. File copy hoặc port PHẢI ghi đường dẫn
  file gốc trong comment đầu file (ví dụ `// Ported from directus/api/src/services/items.ts`).
- Hành vi chuẩn là hành vi của Directus 11.17.4 (api 35.2.0, app 15.10.0). Khi spec không nói rõ,
  app mới PHẢI làm giống Directus.

Lý do: `directus/` là mốc so sánh cho mọi test đối chiếu. Sửa nó làm mất mốc so sánh.

### II. Dùng chung database với Directus

- App mới dùng chung DB với một Directus đang chạy.
- KHÔNG ĐƯỢC tạo, sửa, xóa bảng hay cột hệ thống `directus_*`. KHÔNG ĐƯỢC chạy migration hệ thống.
  Chỉ Directus được migrate.
- Khi khởi động, app mới PHẢI đối chiếu bảng `directus_migrations` với danh sách migration của
  11.17.4. Nếu lệch, app PHẢI dừng và báo lỗi rõ ràng (migration thiếu hoặc thừa).
- Dữ liệu app mới ghi ra (users, sessions, activity, revisions, files, hash mật khẩu argon2, uuid,
  ngày giờ, JSON) PHẢI có định dạng giống hệt Directus, để hai bên đọc ghi lẫn nhau được.
- ĐƯỢC tạo và sửa bảng dữ liệu người dùng qua API collections/fields/relations, giống Directus.

Lý do: hai app chạy trên cùng một DB. Một bên đổi schema hệ thống hoặc định dạng dữ liệu thì bên
kia hỏng.

### III. API giống hệt Directus

- REST API PHẢI giữ nguyên: path; query (`fields`, `filter`, `search`, `sort`, `limit`, `offset`,
  `page`, `meta`, `aggregate`, `groupBy`, `deep`, `alias`, `export`); response `{data, meta}`;
  lỗi `{errors: [{message, extensions: {code}}]}`; HTTP status; header; tên cookie.
- `@directus/sdk` và mọi client đang gọi Directus PHẢI trỏ sang app mới được mà không cần sửa.
- GraphQL (`/graphql`, `/graphql/system`) PHẢI tương thích, trừ subscription.

Lý do: client hiện có là tiêu chí chấp nhận. Mọi khác biệt API đều là lỗi, trừ khi đã ghi nhận
theo Nguyên tắc X.

### IV. Chạy song song an toàn

- Dùng chung `SECRET` và cách ký JWT. Token do app này cấp PHẢI dùng được ở app kia.
- Dùng chung Redis: cùng namespace, cache key, kênh bus, rate limiter. Thay đổi schema hoặc
  permission ở app nào thì cache ở app kia cũng PHẢI bị xóa.
- Flow theo lịch PHẢI dùng lock trên Redis, mỗi lượt chỉ một instance chạy. Flow theo sự kiện chạy
  ở instance nhận request.
- KHÔNG ĐƯỢC giả định là instance duy nhất. KHÔNG ĐƯỢC giữ state quan trọng trong bộ nhớ của một
  process.
- PHẢI đọc cùng tên biến môi trường như Directus (`DB_*`, `SECRET`, `REDIS*`, `CACHE_*`,
  `STORAGE_*`, `PUBLIC_URL`...).

Lý do: người dùng và request có thể đi vào bất kỳ instance nào, Directus hoặc app mới.

### V. Kiểm thử đối chiếu là bắt buộc (NON-NEGOTIABLE)

- Mỗi endpoint PHẢI có test chạy với cả Directus thật và app mới, rồi so sánh status, body và tác
  động lên DB.
- Tái sử dụng bộ test trong `directus/tests/blackbox` (copy sang, cấu hình URL để chạy với cả hai
  app).
- Feature CHƯA xong khi còn khác biệt chưa được ghi lại và chấp nhận trong spec.
- PostgreSQL là DB chính: mọi PR PHẢI chạy đủ test đối chiếu trên Postgres. MySQL và SQLite chạy bộ
  test rút gọn ở mọi PR. MSSQL, Oracle, CockroachDB chạy đủ test hằng đêm.

Lý do: "giống Directus" chỉ kiểm chứng được bằng cách chạy cùng request trên cả hai app.

### VI. Kiến trúc

- Node 22 và pnpm 10 (giống Directus). Nx monorepo: `apps/api` (NestJS), `apps/web` (Vue 3 +
  Reka UI + Pinia + Vue Router), libs dùng chung (types, filter, validation, utils).
- BE: mỗi service của Directus tương ứng một provider NestJS. Controller mỏng, logic nằm trong
  service. Truy cập DB bằng Knex, KHÔNG dùng ORM.
- FE: viết mới bằng Composition API, giữ nguyên luồng màn hình, route và hành vi của Directus app.
  ĐƯỢC copy logic hoặc composable từ `directus/app` khi cần.
- FE hỗ trợ desktop và tablet (màn hình từ 768px) trên Chrome, Edge, Firefox, Safari bản mới.
- FE hỗ trợ hai ngôn ngữ giao diện vi-VN và en-US, copy từ `directus/app/src/lang`. Kiến trúc i18n
  PHẢI cho phép thêm ngôn ngữ sau.
- TypeScript strict, ESLint, Prettier. Mỗi thay đổi PHẢI có test.

Lý do: bám cấu trúc service và Knex của Directus giúp port code trực tiếp và giữ đúng SQL sinh ra.

### VII. Triển khai đa instance

- FE build ra file tĩnh, chạy trong một container nginx. URL API và cấu hình PHẢI đọc lúc chạy
  (runtime config), KHÔNG ghi cứng lúc build. Một image dùng cho mọi môi trường.
- BE PHẢI chạy được nhiều container cùng lúc sau load balancer, cùng với các instance Directus,
  tất cả ngang hàng trên cùng DB và Redis. Không cần sticky session.
- Khi chạy nhiều instance, Redis là bắt buộc cho cache, bus, rate limiter, lock flow theo lịch và
  lock upload TUS. KHÔNG dùng cache hay lock trong bộ nhớ process làm nguồn dữ liệu duy nhất. Cache
  trong process chỉ được phép khi được dựng lại từ DB hoặc Redis và bị xóa qua bus Redis trên mọi
  instance, như Directus.
- File và ảnh đã transform PHẢI lưu trên storage dùng chung (S3, GCS, Azure hoặc volume dùng
  chung). KHÔNG dùng storage local riêng từng container.
- Khởi động nhiều replica cùng lúc PHẢI an toàn: chỉ đọc và kiểm tra migration, KHÔNG ghi gì vào
  bảng hệ thống khi khởi động.
- PHẢI có `/server/health` cho readiness và liveness probe. Khi nhận SIGTERM: ngừng nhận request
  mới, chạy nốt request đang dở, đóng kết nối DB và Redis rồi mới thoát.
- FE và BE nên đặt chung một domain: `/admin/*` vào FE, các path API còn lại vào BE, giống bố cục
  của Directus.

Lý do: hệ thống chạy trên nhiều container ngang hàng, có thể bị tắt hoặc thêm bất kỳ lúc nào.

### VIII. Kế thừa toàn bộ biến môi trường của Directus

- BE PHẢI đọc toàn bộ biến môi trường Directus 11.17.4 hỗ trợ (danh sách và giá trị mặc định trong
  `directus/packages/env/src/constants/defaults.ts` và `directus-variables.ts`), kể cả biến động
  như `DB_*`, `STORAGE_<LOCATION>_*`, `AUTH_<PROVIDER>_*`, `EMAIL_*`, `CACHE_*`, `REDIS_*`.
- Giữ nguyên tên biến, giá trị mặc định và cách đọc: tiền tố ép kiểu (`string:`, `number:`,
  `regex:`, `array:`, `json:`, `boolean:`), hậu tố `_FILE` để đọc secret từ file, `CONFIG_PATH` với
  file `.env`, `.json`, `.yaml`, `.js`.
- KHÔNG đổi tên biến khi đổi thương hiệu. KHÔNG tạo biến mới thay thế biến đã có. Biến chỉ app mới
  cần PHẢI dùng tiền tố `BACKOFFICE_` và PHẢI có giá trị mặc định an toàn.
- Biến Directus mà app mới chưa hỗ trợ: ghi cảnh báo khi khởi động, KHÔNG dừng app.
- Khi deploy, cùng một file `.env`, ConfigMap, Secret đang dùng cho Directus PHẢI chạy được ngay
  cho BE mới mà không cần khai báo lại. FE nhận cấu hình lúc chạy từ chính các biến này (ví dụ
  `PUBLIC_URL`).

Lý do: đội vận hành chỉ duy trì một bộ cấu hình cho cả hai app.

### IX. Đổi thương hiệu Directus thành Backoffice

- Trong app mới, chữ "Directus" mà người dùng hoặc lập trình viên nhìn thấy PHẢI đổi thành
  "Backoffice", miễn là không ảnh hưởng luồng hoạt động hay khả năng chạy song song.
- ĐƯỢC đổi: tên hiển thị, tiêu đề trang, logo, favicon, chuỗi dịch i18n, email template, tên mặc
  định khi `project_name` trống (ví dụ nhãn issuer TFA), header `X-Powered-By`, tiêu đề tài liệu
  OpenAPI, log message, tên package nội bộ (`@directus/*` copy sang thành `@backoffice/*`), tên
  class, biến, comment trong code mới, key localStorage của FE.
- PHẢI giữ nguyên vì ảnh hưởng luồng hoặc tương thích: tên bảng và cột `directus_*`; tên collection
  hệ thống trong API (`directus_users`...); JWT issuer `directus`; tên cookie mặc định
  (`directus_refresh_token`, `directus_session_token`); namespace Redis mặc định (`directus:bus`,
  `directus:lock`, `system-cache`); giá trị mặc định `METRICS_NAME_PREFIX` `directus_` (để dashboard
  giám sát dùng chung cho cả hai app); tên biến môi trường; tên event; mã lỗi; tên type GraphQL;
  thư viện bên thứ ba (`@directus/sdk`); dữ liệu trong DB (không sửa `project_name` hay settings
  đang dùng chung).
- Khi không chắc một chỗ đổi tên có ảnh hưởng luồng hay không: giữ nguyên và ghi vào danh sách cần
  xác nhận.
- Test đối chiếu ĐƯỢC bỏ qua các khác biệt do đổi thương hiệu, nhưng PHẢI liệt kê rõ trong danh sách
  khác biệt được chấp nhận.

Lý do: thương hiệu chỉ là lớp hiển thị. Định danh kỹ thuật dùng chung với Directus phải giữ nguyên.

### X. Chất lượng, quy trình và vận hành

- Ngôn ngữ: `spec.md`, `plan.md`, `tasks.md` và tài liệu viết tiếng Việt. Tên biến, comment, commit
  message và PR viết tiếng Anh. Commit theo Conventional Commits.
- CI trên GitHub Actions. Mỗi PR PHẢI pass: lint, typecheck, unit test, test đối chiếu với Directus,
  E2E (với FE), build Docker image.
- Coverage tối thiểu: 80% cho `apps/api` và libs BE, 60% cho `apps/web`. Dưới ngưỡng thì không
  merge.
- Bảo mật trong CI: quét dependency (pnpm audit, Dependabot), quét secret (gitleaks), phân tích mã
  (CodeQL). KHÔNG commit secret.
- Hiệu năng: với cùng request và dữ liệu, p95 latency và throughput của BE mới KHÔNG được tệ hơn
  Directus quá 10%. Đo bằng benchmark tự động (autocannon, giống `directus/tests/blackbox`) cho các
  endpoint chính: items, auth, files, assets.
- Quy mô thiết kế: tới 2.000 user đồng thời, collection lớn nhất khoảng 10 triệu bản ghi. Benchmark
  và test hiệu năng dùng dữ liệu ở quy mô này.
- Giám sát: log JSON bằng pino, cùng biến `LOG_LEVEL`, `LOG_STYLE` như Directus, mỗi request có
  request id. Endpoint `/metrics` định dạng Prometheus, cùng biến `METRICS_*` và cùng tên metric
  như Directus.
- Không gửi email: mọi chỗ Directus gửi mail (quên mật khẩu, mời user, operation Send Email, email
  thông báo) vẫn PHẢI chạy đúng luồng và trả về như Directus, chỉ bỏ qua bước gửi và ghi log cảnh
  báo.
- Mọi khác biệt so với Directus PHẢI ghi trong spec, nêu lý do, và được tech lead duyệt trong PR.

Lý do: ngưỡng đo được giúp quyết định merge khách quan, không dựa vào cảm nhận.

## XI. Ngoài phạm vi giai đoạn này

- SSO bằng SAML (làm OpenID Connect, OAuth2, LDAP).
- Storage Azure, GCS, Cloudinary, Supabase (chỉ làm Local và S3/tương thích S3).
- Gửi email (xem Nguyên tắc X).
- Realtime WebSocket: `/websocket`, GraphQL subscription, collaborative editing, system logs
  realtime. `/server/info` trả `websocket: false`, giống Directus khi `WEBSOCKETS_ENABLED=false`.
  App web ẩn các tính năng này như Directus app.
- Hệ thống extension, AI/MCP, module deployment của Directus (deploy lên Vercel, Netlify...),
  visual editing, telemetry.

Spec hoặc plan chạm vào các mục trên PHẢI dừng lại và hỏi trước. Hành vi của app mới với các mục
này PHẢI giống Directus khi tính năng đó tắt.

## Quy trình phát triển và cổng kiểm tra

- `/speckit.plan` PHẢI điền mục "Constitution Check" với từng nguyên tắc I–XI (đạt / vi phạm có lý
  do). Kiểm tra lại sau Phase 1.
- `spec.md` PHẢI có mục "Khác biệt so với Directus", gồm cả khác biệt do đổi thương hiệu (IX) và
  danh sách tên cần xác nhận.
- `tasks.md` PHẢI có task test đối chiếu cho mỗi endpoint thêm hoặc sửa (V), và test cho mỗi thay
  đổi (VI).
- Reviewer PHẢI từ chối PR khi: có file trong `directus/` bị đổi; có ghi vào bảng hoặc cột hệ thống
  `directus_*` ngoài luồng API của Directus; có lock hoặc state quan trọng trong bộ nhớ process, hoặc
  cache trong process không dựng lại được từ DB/Redis hay không bị xóa qua bus Redis (Nguyên tắc VII);
  có khác biệt với Directus chưa ghi trong spec; CI chưa pass đủ các cổng ở Nguyên tắc X.

## Governance

- Constitution này đứng trên mọi quy ước và tài liệu khác của dự án. Khi mâu thuẫn, làm theo
  constitution.
- Sửa constitution: mọi thay đổi PHẢI ghi lý do (trong Sync Impact Report ở đầu file và trong PR),
  tăng phiên bản theo semver, và cập nhật các template liên quan trong `.specify/templates/`.
- Quy tắc phiên bản:
  - MAJOR: bỏ hoặc định nghĩa lại một nguyên tắc theo cách không tương thích.
  - MINOR: thêm nguyên tắc hoặc mục mới, hoặc mở rộng đáng kể nội dung.
  - PATCH: làm rõ câu chữ, sửa lỗi chính tả, không đổi ý nghĩa.
- Thay đổi constitution PHẢI được tech lead duyệt trong PR.
- Mỗi PR và mỗi lần review PHẢI kiểm tra tuân thủ. Vi phạm chỉ được chấp nhận khi ghi trong bảng
  "Complexity Tracking" của plan, có lý do và được tech lead duyệt.

**Version**: 1.3.0 | **Ratified**: 2026-10-08 | **Last Amended**: 2026-10-10
