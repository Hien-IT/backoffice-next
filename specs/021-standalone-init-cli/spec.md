# Feature Specification: Chạy độc lập (khởi tạo DB, migration và CLI giống Directus 11.17.4)

**Feature Branch**: `021-standalone-init-cli` (làm trên `main` như 012–020, không tạo branch; `specs/021-*` là thư mục
feature hiện tại theo quy tắc "thư mục số cao nhất" của `.specify/scripts/bash/common.sh`)
**Created**: 2026-10-22
**Status**: Implemented (2026-10-22, ba lượt trên `main`); spec, plan, D-145..D-147, sửa D-19/D-121/D-123/D-141,
ngoại lệ coverage FR-106 đã duyệt (chủ dự án kiêm tech lead, 2026-10-22); chờ duyệt D-149, hai quy tắc FR-107 mới và
câu chữ US5 kịch bản 2 (mục "Cần xác nhận")
**Input**: User description: "Backoffice chạy độc lập: tự khởi tạo DB, chạy migration và có CLI giống Directus 11.17.4.
Khởi động: image API chạy bootstrap rồi start giống directus/Dockerfile, không hỏi gì. DB trống: chờ DB 5 lần x 5 giây,
chạy 15 seed yaml, migrate latest, createAdmin từ ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_TOKEN, ghi PROJECT_NAME, setOwner khi
PROJECT_OWNER là email (không gửi report, D-38). DB đã cài: chỉ migrate latest. Không có lock, giống Directus. Vendor:
Backoffice tự khởi tạo và migrate với Postgres và SQLite; vendor khác thì DB do Directus khởi tạo và migrate, Backoffice
chỉ kiểm tra directus_migrations như hiện nay (ghi thành khác biệt). CLI cho apps/api, port directus/api/src/cli với cùng
lệnh, option, log và exit code: start, init, bootstrap [--skipAdminInit], database install, database
migrate:latest|up|down, users create|passwd, roles create, cache clear [--system|--data], count <collection>, schema
snapshot|apply, security key:generate|secret:generate. Lệnh init chỉ hiện các vendor Backoffice hỗ trợ khởi tạo
(Postgres, SQLite) và không chạy npm install driver vì driver đã có trong image (ghi thành khác biệt); dùng DB khác thì
khởi tạo bằng Directus. Migration: port nguyên văn directus/api/src/database/migrations/run.ts và 103 file của 11.17.4,
cùng custom migration trong MIGRATIONS_PATH; ghim 11.17.4. Tương thích: DB do Backoffice bootstrap thì Directus 11.17.4
khởi động, đăng nhập và migrate được, và ngược lại; validate-migrations.ts vẫn đạt. Deploy chế độ độc lập: compose có
service chạy bootstrap một lần rồi mới start các replica API, không có Directus; Helm có Job hook pre-install/pre-upgrade
tạo pod riêng chạy bootstrap một lần, Deployment chỉ tạo sau khi Job xong và pod API chỉ chạy start, ConfigMap/Secret mà
Job cần phải có trước Job, không cần ConfigMap, Secret hay PVC của Directus; chế độ chạy chung của 019 giữ nguyên. Ngoài
phạm vi khi chạy độc lập: gửi email, WebSocket, SAML, storage ngoài Local/S3 và các mục XI khác; liệt kê trong "Khác biệt
so với Directus". Test đối chiếu trên Postgres và SQLite: bootstrap DB trống bằng Directus và bằng Backoffice rồi so sánh
schema, các hàng hệ thống (bỏ qua uuid, thời gian, hash) và directus_migrations; chạy migrate latest/up/down với bộ custom
migration mẫu ở cả hai app; so sánh output và exit code của từng lệnh CLI; acceptance deploy độc lập trên compose và kind
(install, rồi upgrade có custom migration mới)."

**Điều kiện trước `/speckit.plan`** (Governance):

- Constitution 3.0.0 (2026-10-22): Nguyên tắc II cho Backoffice khởi tạo DB và chạy migration giống Directus 11.17.4
  (Postgres, SQLite), Nguyên tắc VII thêm ngoại lệ `bootstrap`. Chủ dự án (kiêm tech lead) yêu cầu và duyệt
  2026-10-22; commit cùng spec này.
- Số migration hệ thống của Directus 11.17.4 là **101** file (`directus/api/src/database/migrations`, trừ `run.ts` và
  `run.test.ts`; danh sách `DIRECTUS_MIGRATIONS` của 001 cũng có 101 version). Input ghi "103" là đếm nhầm hai file đó;
  spec này dùng 101.

**Đã có từ các feature trước** (khảo sát 2026-10-22, không làm lại):

- Kiểm tra migration lúc khởi động: `apps/api/src/database/validate-migrations.ts` (001 FR-031, D-05, D-06) so
  `directus_migrations` với `DIRECTUS_MIGRATIONS` (`database/migrations/directus-11.17.4.ts`) cộng custom migration ở
  `MIGRATIONS_PATH` và `<EXTENSIONS_PATH>/migrations`; lệch thì dừng với mã 1. `MIGRATIONS_PATH` đã đọc
  (`config/supported-variables.ts`), mặc định `./migrations` như Directus.
- Trình tự khởi động `apps/api/src/startup/run-startup-checks.ts` rồi `server.ts` (001 contracts/startup.md): đây là
  phần "start" của CLI.
- `apps/api/src/utils/create-admin.ts` (010, port nguyên văn), `SettingsService.setOwner` không gửi owner report (010
  D-38), `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_TOKEN` đã đọc; `PROJECT_OWNER` đang nằm ở `NOT_APPLICABLE_VARIABLES`.
- Các service và util mà lệnh CLI của Directus gọi đều đã port: `UsersService`, `RolesService`, `PoliciesService`,
  `AccessService`, `SettingsService` (004, 010); `generate-hash` (003); `get-snapshot`, `get-snapshot-diff`,
  `apply-snapshot`, `apply-diff`, `validate-snapshot` (006); `clearSystemCache`, `getCache`, `flushCaches` (002, 005);
  `getDatabase`, `hasDatabaseConnection`, `validateDatabaseConnection`, `isInstalled` (001); database helpers theo
  vendor (001, 004, 006); extension manager với `initialize({ schedule, watch })` (020).
- Image API (019): `/directus`, uid 1000, `tini`, `ENV DB_CLIENT=sqlite3`, `DB_FILENAME=/directus/database/database.sqlite`
  như image Directus; CMD hiện là `node dist/main.js`. Compose `deploy/compose` và chart `deploy/helm/backoffice`
  (019, 020) chạy chung với Directus; bộ test chấp nhận `tests/parity/src/deploy` (`parity-tests:deploy`) và job CI
  `deploy`, `deploy-k8s` (kind).
- Profile parity `setup` (010): cặp Directus + Backoffice trên Postgres riêng do image Directus bootstrap, Redis db 9.

**Gỡ hoặc sửa khác biệt cũ** (ghi lại ở bảng "Khác biệt so với Directus" của spec này):

- 001 D-19: phần "không `bootstrap`" bỏ; phần "một process, không PM2, `/metrics` của process đó" giữ.
- 019 D-121: sửa như D-19 (image chạy `bootstrap` rồi một process Node dưới `tini`).
- 019 D-123 (image Backoffice không có CLI): gỡ.
- 019 US1 kịch bản 4, FR-024, FR-042 và `deploy/README.md` mục "Lệnh CLI", "Thay image Directus bằng Backoffice":
  không còn phải chạy `directus bootstrap` trước khi chạy Backoffice trên Postgres hay SQLite.
- 020 D-141: phần "không CLI nên không phát `cli.before`/`cli.after`" gỡ; phần còn lại giữ.

## User Scenarios & Testing *(mandatory)*

Người dùng của feature này là đội vận hành và lập trình viên: người dựng Backoffice trên một DB trống mà không có
Directus, người nâng cấp hệ thống đang chạy, người chạy lệnh quản trị (tạo user, đổi mật khẩu, snapshot schema) bằng
image Backoffice. Người dùng cuối chỉ thấy kết quả: hệ thống khởi động được và đăng nhập được.

### User Story 1 - Một container trên DB trống tự khởi tạo và chạy như image Directus (Priority: P1)

Đội vận hành chạy image Backoffice với env của Directus (`DB_*`, `SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PUBLIC_URL`)
trên một Postgres trống, hoặc không env nào (SQLite ở `/directus/database`, như image Directus). Container tự tạo bảng hệ
thống, chạy migration, tạo role, policy và user admin, rồi phục vụ API. Không có Directus trong hệ thống.

**Why this priority**: Đây là lý do của feature: Backoffice chạy một mình. Mọi kịch bản khác (CLI, compose, Helm) xây
trên `bootstrap`.

**Independent Test**: `docker run` image API với Postgres trống (và lần nữa không env, SQLite); chờ `/server/ping`;
đăng nhập bằng `ADMIN_EMAIL`/`ADMIN_PASSWORD`; dump schema và các hàng hệ thống rồi so với DB do image Directus 11.17.4
bootstrap với cùng env.

**Acceptance Scenarios**:

1. **Given** Postgres trống và env Directus có `ADMIN_EMAIL`, `ADMIN_PASSWORD`, **When** container Backoffice khởi
   động, **Then** log ghi `Initializing bootstrap...`, `Installing ... system tables...`, `Running migrations...`,
   `Applying <tên>...` cho từng migration, `Setting up first admin role...`, `Adding first admin user...`, `Done`, rồi
   server khởi động; `directus_migrations` có đúng 101 hàng với version và `name` như Directus; đăng nhập bằng admin
   thành công; `GET /server/info` và `/server/health` như 001.
2. **Given** cùng Postgres trống, **When** bootstrap bằng image Directus 11.17.4 với cùng env, **Then** dump schema (bảng,
   cột, kiểu, nullable, default, khóa chính, khóa ngoại, unique, index) của hai DB giống nhau; các hàng hệ thống
   (`directus_roles`, `directus_policies`, `directus_access`, `directus_users`, `directus_settings`,
   `directus_migrations`, mọi bảng khác có hàng) giống nhau sau khi bỏ uuid, thời gian và hash mật khẩu.
3. **Given** container không có env nào, **When** khởi động, **Then** Backoffice tạo file SQLite
   `/directus/database/database.sqlite`, bootstrap, và chạy như image Directus không env; file do hai image tạo có cùng
   `.schema` và cùng hàng hệ thống (bỏ uuid, thời gian, hash).
4. **Given** `ADMIN_EMAIL`/`ADMIN_PASSWORD` trống, **When** bootstrap DB trống, **Then** role và policy Administrator
   được tạo, không có user (như `createAdmin` của Directus); `POST /server/setup` của 010 vẫn tạo được admin sau đó.
5. **Given** `PROJECT_NAME=Acme` và `PROJECT_OWNER=owner@example.com`, **When** bootstrap DB trống, **Then**
   `directus_settings.project_name = Acme`; `setOwner` được gọi hai lần như Directus (trong migration
   `20251014A-add-project-owner`, rồi ở bước cuối của `bootstrap`), mỗi lần ghi `project_owner` và `project_status:
   null`, không có kết nối ra ngoài, mỗi lần một dòng log cảnh báo thay cho owner report (D-38); `PROJECT_OWNER` và
   `ACCEPT_TERMS` không còn bị báo là biến không hỗ trợ hay không áp dụng.
6. **Given** DB chưa sẵn sàng khi container khởi động, **When** bootstrap chạy, **Then** thử kết nối 5 lần, mỗi lần cách
   5 giây, như Directus; hết 5 lần thì dừng với mã 1 và lỗi kết nối như `validateDatabaseConnection`.
7. **Given** DB do Backoffice bootstrap, **When** chạy image Directus 11.17.4 trên DB đó, **Then** Directus khởi động
   không cảnh báo migration, đăng nhập được bằng admin, đọc và ghi item được; `node cli.js database migrate:down` của
   Directus gỡ được migration cuối cùng rồi `migrate:latest` chạy lại được.

---

### User Story 2 - DB đã cài: mỗi lần khởi động chỉ chạy migration còn thiếu (Priority: P1)

Hệ thống đang chạy (do Directus hoặc Backoffice tạo). Đội vận hành thêm một custom migration vào `MIGRATIONS_PATH` hoặc
chỉ khởi động lại. Container chạy `bootstrap`: DB đã cài nên chỉ `migrate latest`, rồi `start`.

**Why this priority**: Đây là đường nâng cấp thường ngày và là cách Directus hoạt động; không có nó, custom migration
phải chạy bằng tay.

**Independent Test**: DB đã bootstrap; thêm `20991231A-sample.js` vào `MIGRATIONS_PATH`; khởi động lại container; kiểm
`directus_migrations` và schema; làm y hệt với image Directus và so.

**Acceptance Scenarios**:

1. **Given** DB đã cài, không migration mới, **When** container khởi động, **Then** log ghi `Database already
   initialized, skipping install`, `Running migrations...`, `Done`, không ghi gì vào DB, server khởi động; kiểm tra
   migration của 001 vẫn đạt.
2. **Given** `MIGRATIONS_PATH` có một custom migration chưa chạy, **When** container khởi động, **Then** migration được
   áp theo thứ tự version, hàng mới trong `directus_migrations` có `version`, `name` (tiêu đề từ tên file như
   `@directus/format-title`) và `timestamp`; cache hệ thống và cache dữ liệu bị xóa trên mọi instance (Directus và
   Backoffice) qua bus Redis như `flushCaches(true)` của Directus.
3. **Given** cùng custom migration, **When** image Directus chạy `bootstrap` thay vì Backoffice, **Then** hàng
   `directus_migrations` và schema kết quả giống nhau.
4. **Given** `directus_migrations` có version không thuộc 11.17.4 và không có file ở `MIGRATIONS_PATH`/
   `<EXTENSIONS_PATH>/migrations`, **When** container khởi động, **Then** `bootstrap` chạy xong (Directus không kiểm
   version thừa), rồi `start` dừng với mã 1 và liệt kê version thừa (001 D-05, D-06 giữ nguyên).

---

### User Story 3 - Lệnh CLI giống Directus trong image Backoffice (Priority: P1)

Đội vận hành chạy `node cli.js <lệnh>` trong thư mục `/directus` của image Backoffice đúng như với image Directus: tạo
user, đổi mật khẩu, tạo role, xóa cache, đếm item, sinh `KEY`/`SECRET`, snapshot và apply schema, cài DB, chạy hoặc gỡ
migration. Script và tài liệu viết cho Directus dùng được không sửa.

**Why this priority**: Không có Directus thì đây là cách duy nhất làm các việc quản trị ngoài API; D-123 của 019 đang
bắt dùng image Directus.

**Independent Test**: Chạy từng lệnh với cùng tham số trên image Directus và image Backoffice trên hai DB giống nhau; so
exit code, stdout, log (sau chuẩn hóa thương hiệu, thời gian, uuid) và tác động lên DB.

**Acceptance Scenarios**:

1. **Given** DB đã cài, **When** `node cli.js users create --email a@b.c --password p --role <id>`, **Then** stdout là
   id user mới và một dòng xuống dòng, mã 0; thiếu tham số thì log lỗi `Email, password, role are required`, mã 1; user
   có `status: active`, hash argon2 đọc được bởi Directus.
2. **Given** user tồn tại, **When** `users passwd --email A@B.C --password new`, **Then** so email không phân biệt hoa
   thường, log `Password is updated for user <id>`, mã 0; không có user thì log `No such user by this email`, mã 1.
3. **Given** DB đã cài, **When** `roles create --role Editors --app`, **Then** tạo policy `Policy for Editors`
   (`admin_access` theo `--admin`, `app_access` theo `--app`, icon `supervised_user_circle`), role `Editors`, một hàng
   `directus_access` nối hai bên; stdout là id role, mã 0.
4. **Given** `CACHE_STORE=redis`, **When** `cache clear` (và `--system`, `--data`), **Then** xóa đúng phần như Directus
   trên Redis dùng chung (Directus đang chạy cũng thấy cache trống), stdout `Cleared <phần> successfully`, mã 0;
   `CACHE_STORE=memory` thì in thông báo "In-memory caches are local..." và mã 0, không xóa gì.
5. **Given** collection có N item, **When** `count <collection>`, **Then** stdout `N`, mã 0; collection không tồn tại thì
   log lỗi của DB, mã 1.
6. **Given** bất kỳ, **When** `security key:generate` và `security secret:generate`, **Then** stdout là một UUID v4 và
   một chuỗi nanoid 32 ký tự, không xuống dòng, mã 0.
7. **Given** DB đã cài, **When** `schema snapshot [path] [--format json|yaml] [-y]` và `schema apply <path> [-y]
   [--dry-run] [--ignoreRules a.b,c]`, **Then** nội dung snapshot, hỏi ghi đè, bản kế hoạch (`Collections:`, `Fields:`,
   `Relations:` với Create/Update/Delete), hỏi xác nhận, kết quả áp và exit code như Directus; DB chưa cài thì apply log
   lỗi `Backoffice isn't installed on this database. Please run "backoffice bootstrap" first.` (FR-057, D-147) và mã 0
   như Directus.
8. **Given** DB trống, **When** `database install`, **Then** tạo đủ bảng hệ thống từ 15 seed, mã 0; DB đã cài thì log
   `Database is already installed`, mã 1.
9. **Given** DB đã cài, **When** `database migrate:latest|up|down`, **Then** hành vi của US4; `migrate:up` khi không còn
   gì thì log `Nothing to upgrade`, mã 1; `migrate:down` khi không có hàng thì `Nothing to downgrade`, mã 1.
10. **Given** DB đã cài và có extension hook (020), **When** chạy bất kỳ lệnh CLI nào, **Then** extension được nạp trước
    khi lệnh chạy (không schedule, không watch) và hook `cli.before` (trước khi khai báo lệnh) và `cli.after` nhận
    `program`, như `createCli` của Directus; DB chưa cài hoặc còn migration chưa chạy thì bỏ qua nạp extension với log như
    Directus.
11. **Given** bất kỳ, **When** `node cli.js --help`, `--version` và `node cli.js <lệnh> --help` cho từng lệnh, **Then**
    liệt kê đúng các lệnh, option, mô tả và giá trị mặc định của Directus 11.17.4 (tên chương trình và phiên bản theo
    IX, xem D-147); lệnh hoặc option không tồn tại cho cùng lỗi và mã thoát của commander như Directus.

---

### User Story 4 - Migration chung với Directus: cùng thư mục, cùng kết quả, hai chiều (Priority: P1)

Hệ thống chạy chung (019) hoặc đã chuyển sang Backoffice. Custom migration nằm ở `MIGRATIONS_PATH` dùng chung (volume).
Bất kỳ app nào chạy `migrate:latest` thì app kia khởi động được; `migrate:down` ở app này gỡ được migration app kia đã
chạy.

**Why this priority**: Nguyên tắc II (3.0.0): DB do bên nào tạo hay migrate cũng phải dùng được với bên kia.

**Independent Test**: Bộ custom migration mẫu (3 file: thêm bảng, thêm cột có default, migration dùng Knex transaction);
chạy `latest` ở Backoffice → Directus khởi động, `down` ở Directus → Backoffice `up` → so `directus_migrations` và
schema sau mỗi bước.

**Acceptance Scenarios**:

1. **Given** 3 custom migration mẫu ở `MIGRATIONS_PATH`, **When** Backoffice `migrate:latest`, **Then** áp cả 3 theo
   thứ tự version, mỗi migration một hàng, cache bị xóa một lần sau cùng; Directus khởi động trên DB đó không cảnh báo.
2. **Given** DB ở bước 1, **When** Directus `migrate:down`, **Then** gỡ migration có `timestamp` rồi `version` lớn nhất
   và xóa hàng; **When** Backoffice `migrate:up`, **Then** áp lại đúng migration đó (migration đầu tiên có version lớn
   hơn version cao nhất đã chạy và chưa `completed`), như `up()` của Directus.
3. **Given** một custom migration có version trùng một migration hệ thống (ví dụ `20201028A-x.js`), **When** chạy bất kỳ
   lệnh migrate nào, **Then** lỗi `Migration keys collide! Please ensure that every migration uses a unique key.`, mã 1,
   không ghi gì.
4. **Given** file ở `MIGRATIONS_PATH` không có `-` trong tên hoặc không phải `.js`/`.cjs`/`.mjs`, **When** `migrate`,
   **Then** bị bỏ qua như Directus; file `.ts` ở `MIGRATIONS_PATH` cũng bị bỏ qua (Directus chỉ nhận `.ts` cho migration
   hệ thống trong thư mục của nó).
5. **Given** migration không export `up` (hoặc `down`), **When** chạy, **Then** log cảnh báo `Couldn't find the "up"
   function from migration <file>` rồi lỗi như Directus (Directus gọi `up` undefined → ném lỗi, mã 1).
6. **Given** migration hệ thống của Backoffice (101 file port), **When** so với `directus_migrations` do Directus tạo,
   **Then** `version` và `name` giống từng hàng; thứ tự áp giống (sắp theo version chuỗi).

---

### User Story 5 - Compose độc lập: một lệnh dựng hệ thống không có Directus (Priority: P2)

Lập trình viên dựng môi trường dev chỉ có Backoffice (N replica), Postgres, Redis, MinIO, FE và load balancer. Một
service chạy `bootstrap` một lần; các replica chỉ `start` sau khi service đó xong.

**Why this priority**: Môi trường dev và test chấp nhận cho chế độ độc lập; dùng lại gần hết compose của 019.

**Independent Test**: `docker compose -f ... up -d --wait` với `BACKOFFICE_REPLICAS=3`; đăng nhập qua lb; thêm custom
migration vào volume rồi `up` lại; kiểm `directus_migrations`.

**Acceptance Scenarios**:

1. **Given** máy chỉ có Docker, **When** chạy compose chế độ độc lập, **Then** thứ tự là Postgres, Redis, MinIO healthy →
   service `bootstrap` chạy xong (mã 0) → N replica API, FE → lb; đăng nhập qua `/admin` bằng `ADMIN_EMAIL`; không có
   container Directus.
2. **Given** hệ thống đang chạy, **When** thêm custom migration vào volume `MIGRATIONS_PATH` và `docker compose up -d`
   lại, **Then** service `bootstrap` chạy lại, áp migration một lần, các replica khởi động lại sau đó; không replica nào
   tự chạy migration. *(Khi làm T066, 2026-10-22: Compose v5.5.0 chạy lại `bootstrap` nhưng không khởi động lại replica
   đang chạy, kể cả với `depends_on.restart: true`; replica tiếp tục phục vụ, cache bị xóa sau migration. Đề xuất sửa
   "các replica khởi động lại" thành "các replica đang chạy giữ nguyên; muốn khởi động lại thì `up -d --no-deps
   --force-recreate backoffice-api`"; chờ chủ dự án duyệt.)*
3. **Given** service `bootstrap` lỗi (DB không kết nối được sau 5 lần, hoặc custom migration ném lỗi), **When** `up
   --wait`, **Then** replica API không được tạo hay tạo lại, lệnh báo lỗi của service `bootstrap` (mã khác 0); trên hệ
   thống đang chạy, các replica đã chạy giữ nguyên (không dừng, không khởi động lại) và vẫn phục vụ với schema cũ.
4. **Given** compose chế độ chung của 019 (có Directus), **When** `up`, **Then** hành vi như 019: Directus bootstrap rồi
   các replica Backoffice khởi động bằng CMD của image (bootstrap rồi start) như container Directus; trên DB đã cài
   `bootstrap` chỉ `migrate latest` (không ghi gì khi không có migration mới); các test chấp nhận của 019 và 020 vẫn
   đạt.

---

### User Story 6 - Helm độc lập: Job bootstrap trước Deployment, upgrade có migration (Priority: P2)

Đội vận hành cài chart ở chế độ độc lập: ConfigMap và Secret giữ env (định dạng Directus) do họ tạo trước; `helm
install` chạy một Job `bootstrap` trong pod riêng trước khi tạo Deployment; `helm upgrade` chạy lại Job (áp migration
mới) trước khi rolling update. Pod API chỉ chạy `start`.

**Why this priority**: Môi trường thật của chế độ độc lập; nhiều replica và HPA không được bootstrap song song (Nguyên
tắc VII).

**Independent Test**: Trên kind: tạo ConfigMap/Secret, `helm install` → Job Succeeded rồi pod Ready, đăng nhập; đưa
custom migration vào (ConfigMap `MIGRATIONS_PATH` hoặc image có migration) rồi `helm upgrade` → Job chạy lại, pod mới
Ready, `directus_migrations` có hàng mới; `helm template` và kubeconform đạt.

**Acceptance Scenarios**:

1. **Given** namespace có ConfigMap và Secret env nhưng chưa có Directus, **When** `helm install` chế độ độc lập, **Then**
   Job `bootstrap` (hook `pre-install`, `pre-upgrade`) chạy `node cli.js bootstrap` với cùng `envFrom`, uid 1000, cùng
   volume uploads nếu có; Deployment, Service, Ingress chỉ được tạo sau khi Job thành công; pod API chạy `start`, Ready
   theo probe của 019.
2. **Given** chart đã cài và values trỏ một ConfigMap chứa custom migration (mount vào `MIGRATIONS_PATH` ở Job và
   Deployment, FR-085), **When** thêm file vào ConfigMap rồi `helm upgrade`, **Then** Job chạy lại trước rolling update,
   migration áp đúng một lần, pod cũ vẫn phục vụ tới khi pod mới Ready; 0 request lỗi dưới tải như 019 SC-003. File
   đặt sẵn trong image ở `/directus/migrations` cũng được áp như vậy.
3. **Given** Job thất bại (DB không kết nối được, migration lỗi), **When** `helm upgrade`, **Then** Helm dừng với lỗi,
   Deployment và release đang chạy không đổi; log của Job còn xem được (Job không bị xóa khi lỗi). **When** `helm
   install` lần đầu, **Then** release ở trạng thái `failed`, không có Deployment; tài liệu ghi cách làm lại: sửa nguyên
   nhân, xử lý DB theo FR-015 nếu DB cài dở hoặc migration lỗi giữa chừng, `helm uninstall` rồi `helm install`.
4. **Given** chế độ độc lập, **When** `helm install` mà ConfigMap hoặc Secret không tồn tại, **Then** chart dừng ở
   install với thông báo rõ ràng (hai resource phải có trước Job); các kiểm tra 019 FR-053 (Redis, `*_STORE`, `SECRET`,
   `DB_CLIENT`, storage) và 020 FR-045 (`EXTENSIONS_LOCATION`) vẫn chạy trên env đó; kiểm tra chỉ dành cho chế độ chung
   (cookie domain của domain riêng, 019 FR-076) không chạy.
5. **Given** chế độ chung của 019 (Directus có trong namespace), **When** install/upgrade chart đã nâng lên 021, **Then**
   không có Job; pod Backoffice khởi động bằng CMD của image (`bootstrap` trên DB đã cài chỉ `migrate latest`, rồi
   `start`) như pod Directus; Deployment, Service, Ingress, HPA như 019; `deploy-k8s` của 019/020 vẫn đạt.

---

### User Story 7 - Vendor ngoài Postgres và SQLite: báo rõ và chỉ sang Directus (Priority: P2)

Đội vận hành dùng MySQL/MariaDB, MSSQL, Oracle hoặc CockroachDB. Backoffice không khởi tạo hay migrate các DB này: lệnh
dừng với thông báo rõ ràng; DB do Directus khởi tạo và migrate; Backoffice `start` trên DB đó như trước 021.

**Why this priority**: Chủ dự án chọn phạm vi Postgres và SQLite (2026-10-22); các vendor khác vẫn chạy chung với
Directus như 001–020.

**Independent Test**: `DB_CLIENT=mysql` với DB trống: `bootstrap`, `database install`, `database migrate:latest` dừng mã
1 với thông báo; DB do Directus bootstrap: container khởi động (CMD `bootstrap` rồi `start`) và API chạy như trước.

**Acceptance Scenarios**:

1. **Given** `DB_CLIENT` là `mysql`, `mssql`, `oracledb` hoặc `cockroachdb` và DB trống, **When** `bootstrap`,
   `database install` hoặc `database migrate:*`, **Then** log lỗi nêu vendor không được Backoffice khởi tạo/migrate và
   chỉ dùng image Directus 11.17.4, mã 1, không ghi gì vào DB (D-145).
2. **Given** vendor đó và DB do Directus bootstrap, migration khớp, **When** container Backoffice khởi động (CMD
   `bootstrap` rồi `start`), **Then** `bootstrap` nhận ra DB đã cài, **không** chạy migration (D-145), chỉ ghi log rồi
   thoát mã 0; `start` chạy như 001–020.
3. **Given** vendor đó, DB đã cài nhưng có custom migration chưa chạy, **When** container khởi động, **Then** `bootstrap`
   thoát mã 0 (không migrate), `start` dừng mã 1 và liệt kê version thiếu (001 D-05); tài liệu ghi chạy
   `migrate:latest` bằng image Directus.
4. **Given** `node cli.js init`, **When** chọn vendor, **Then** danh sách chỉ có `PostgreSQL / Redshift` và `SQLite`
   (D-146); các lệnh khác (`users`, `roles`, `cache`, `count`, `schema`, `security`) chạy với mọi vendor như Directus.

---

### User Story 8 - `init`: tạo project mới bằng hỏi đáp (Priority: P3)

Lập trình viên chạy `node cli.js init` trong một thư mục: chọn vendor, nhập thông tin kết nối, CLI tạo bảng và chạy
migration (tối đa 5 lần thử), ghi `.env`, hỏi email và mật khẩu admin rồi tạo role, policy, access, user. Không cài
driver bằng `npm install` vì image đã có `pg` và `sqlite3`.

**Why this priority**: Ít dùng trong container, nhưng là một lệnh của Directus và là cách nhanh nhất để có `.env` mẫu.

**Independent Test**: Chạy `init` không tương tác (nhập qua stdin) với SQLite trong thư mục tạm; kiểm `.env` (mode
0640, `SECRET` nanoid 32, `DB_CLIENT`, `DB_FILENAME`), file DB có đủ bảng, user admin đăng nhập được khi `start` với
`.env` đó.

**Acceptance Scenarios**:

1. **Given** thư mục trống, **When** `init` chọn SQLite với đường dẫn mặc định `<cwd>/data.db`, **Then** seed và
   migration chạy, `.env` được ghi từ mẫu của Directus (chữ Directus đổi thành Backoffice theo IX, D-147), hỏi email
   (mặc định `admin@example.com`, kiểm email) và mật khẩu (không rỗng), tạo role/policy/user như `init` của Directus
   (ghi thẳng vào bảng, không qua service), in hướng dẫn khởi động, mã 0.
2. **Given** thông tin kết nối Postgres sai, **When** `init`, **Then** in `Something went wrong while seeding the
   database:` với mã lỗi, hỏi lại tối đa 5 lần, hết thì `Couldn't seed the database. Exiting.`, mã 1.
3. **Given** chọn Postgres, **When** hỏi, **Then** các câu hỏi là host (mặc định 127.0.0.1), port (5432), database
   (`directus`), user, password, SSL, như `questions.ts` của Directus.
4. **Given** thư mục đã có `.env`, **When** `init` chạy xong phần DB, **Then** `.env` bị ghi đè không hỏi, như Directus
   (`writeFile`); tài liệu ghi cảnh báo này.

---

### Edge Cases

- **Hai container cùng bootstrap một DB trống** (compose chế độ độc lập khi người dùng chạy `bootstrap` tay song song;
  hai image khác nhau): không có lock, như Directus; bên sau lỗi "relation already exists" ở seed và thoát mã 1; tài
  liệu ghi chỉ chạy `bootstrap` ở một nơi (service `bootstrap` của compose, Job của Helm). Spec không thêm lock (chủ dự
  án 2026-10-22).
- **Chế độ chung, N replica Backoffice (và container Directus) cùng khởi động khi có custom migration mới**: mỗi
  container tự `bootstrap` (Q1) nên có thể áp cùng migration song song; migration idempotent thì vô hại, migration tạo
  bảng thì bên sau lỗi và container khởi động lại tới khi `directus_migrations` đã có hàng. Giống N container Directus;
  tài liệu ghi: triển khai custom migration ở chế độ chung thì giảm về 1 replica hoặc chạy `migrate:latest` bằng tay
  trước.
- **DB cài dở** (seed lỗi giữa chừng: có `directus_collections` nhưng thiếu ít nhất một bảng khác của 15 seed): giống
  Directus. `isInstalled` coi là đã cài, `bootstrap` log `Database already initialized, skipping install`, chạy `migrate
  latest` rồi lỗi ở migration đầu tiên chạm bảng thiếu, mã 1. Không tự phát hiện, không tự sửa (FR-015, chủ dự án
  2026-10-22).
- **Seed xong nhưng migration hệ thống lỗi giữa chừng trên DB vừa tạo** (hoặc container bị tắt khi đang migrate): giống
  Directus. Hàng `directus_migrations` chỉ ghi sau `up()` thành công; lần sau chạy lại migration đó; migration không
  trong transaction nên có thể lỗi tiếp do DDL dở. Phục hồi theo tài liệu (FR-015).
- **Custom migration lỗi**: hàng chưa ghi; sửa file rồi chạy lại `bootstrap` hoặc `migrate:latest` (như Directus).
- **`migrate:down` gỡ một migration hệ thống 11.17.4** (không phải custom): được phép như Directus; sau đó `start` dừng
  vì thiếu migration (001 D-05) cho tới khi `migrate:latest` (hoặc `bootstrap`) áp lại. Tài liệu ghi cảnh báo.
- **`bootstrap` trên DB do Directus cũ hơn 11.17.4 tạo**: `migrate latest` áp các version còn thiếu và nâng DB lên
  11.17.4, như image Directus 11.17.4 (chủ dự án 2026-10-22). Tài liệu ghi: đổi một node sang image Backoffice là nâng
  hệ thống lên 11.17.4; mọi node Directus chạy chung phải là 11.17.4 (như 019).
- **`bootstrap` trên DB do Directus mới hơn 11.17.4 tạo**: `migrate latest` chỉ áp các version chưa có trong
  `directus_migrations`; version thừa của bản mới hơn không bị đụng; `start` sau đó dừng (D-05). Không có đường "hạ cấp"
  ngầm.
- **Chế độ chung trên DB trống**: điều kiện trước của 019 (FR-024) giữ nguyên: DB phải được Directus bootstrap trước khi
  chạy Backoffice cùng nó (compose có thứ tự 019 FR-042; Kubernetes không có thứ tự giữa hai Deployment). Nếu vẫn khởi
  động cùng lúc trên DB trống, hai bên cùng seed, bên sau lỗi và pod khởi động lại, như N pod Directus; NOTES của chart
  và README ghi điều kiện này (chủ dự án 2026-10-22).
- **`docker run` không env và không mount `/directus/database`**: file SQLite nằm trong container và mất khi xóa
  container, như image Directus; tài liệu ghi cách mount volume.
- **`MIGRATIONS_PATH` tương đối**: giải theo thư mục làm việc (`/directus` trong image), như Directus
  (`path.resolve`).
- **Custom migration ở `<EXTENSIONS_PATH>/migrations` nhưng không ở `MIGRATIONS_PATH`**: `migrate` không chạy (Directus
  cũng không), `start` của Backoffice chấp nhận version đó (001 D-06) nhưng báo thiếu vì chưa chạy; tài liệu ghi đặt
  custom migration ở `MIGRATIONS_PATH`.
- **SQLite với nhiều replica**: chart 019 đã chặn `DB_CLIENT=sqlite3` (FR-053); compose chế độ độc lập dùng Postgres;
  SQLite chỉ cho một container.
- **`PROJECT_OWNER` không phải email**: bỏ qua không lỗi, như Directus (`email().safeParse`).
- **`ADMIN_TOKEN` đặt**: user admin có `token` đó (như Directus); không in ra log (FR-016).
- **CLI chạy khi API đang chạy trên cùng DB**: được, như Directus; `cache clear` và `migrate` xóa cache của mọi instance
  qua bus Redis; `schema apply` xóa cache schema như API `/schema/apply` của 006.
- **`cli.js` gọi ở thư mục khác `/directus`**: `MIGRATIONS_PATH`, `EXTENSIONS_PATH`, `DB_FILENAME` tương đối giải theo
  cwd, như Directus.
- **Lỗi không bắt trong CLI** (`createCli().catch`): in lỗi ra stderr bằng `console.error`, mã 1, như `cli/run.ts`.

### Truy vết user story và requirement

| Nguồn | Nội dung | Đích |
|-------|----------|------|
| Constitution 3.0.0 II | Khởi tạo DB và migration giống Directus, Postgres và SQLite, DB dùng được hai chiều | US1, US2, US4, US7, FR-001..FR-035 |
| Constitution 3.0.0 VII | `bootstrap` chạy một lần khi nhiều replica ở chế độ độc lập; chế độ chung như container Directus (Q1) | US5, US6, FR-060..FR-083 |
| 001 D-05, D-06 | Kiểm tra migration lúc `start` giữ nguyên | US2 kịch bản 4, FR-004, FR-036 |
| 010 D-38 | `setOwner` không gửi report | US1 kịch bản 5, FR-010 |
| 019 D-123, README "Lệnh CLI" | CLI trong image Backoffice | US3, FR-040..FR-057 |
| 020 D-141 | `cli.before`/`cli.after` | US3 kịch bản 10, FR-043 |
| Chủ dự án 2026-10-22 | Phạm vi vendor, không lock, Helm Job, `init` chỉ hiện vendor hỗ trợ, ghim 11.17.4 | US6, US7, US8, D-145, D-146 |
| Checklist `pre-tasks.md` (2026-10-22) | DB cài dở và phục hồi (như Directus), nâng DB cũ, chế độ chung trên DB trống, Redshift | FR-015, FR-016, FR-063, FR-085, FR-107, Edge Cases |

## Requirements *(mandatory)*

### Functional Requirements

**Khởi động và `bootstrap`** (port `directus/api/src/cli/commands/bootstrap/index.ts`):

- **FR-001**: Image API PHẢI khởi động bằng `bootstrap` rồi `start` (cùng ý nghĩa với
  `node cli.js bootstrap && pm2-runtime start` của `directus/Dockerfile`): `bootstrap` thoát khác 0 thì container thoát
  với mã đó và không `start`.
- **FR-002**: `bootstrap` PHẢI chờ DB như `waitForDatabase`: tối đa 5 lần thử, cách nhau 5 giây; hết thì
  `validateDatabaseConnection` ném lỗi và thoát mã 1.
- **FR-003**: Khi `isInstalled()` là `false` (không có bảng `directus_collections`): chạy seed (FR-011), `migrate
  latest` (FR-020), `createAdmin` (FR-009), `PROJECT_NAME` và `PROJECT_OWNER` (FR-010), rồi `database.destroy()`,
  log `Done`, thoát mã 0. Khi `true`: log `Database already initialized, skipping install`, `Running migrations...`,
  `migrate latest`, `Done`, mã 0.
- **FR-004**: `bootstrap` KHÔNG kiểm tra version thừa (Directus không kiểm); `start` giữ nguyên kiểm tra của 001
  (`validate-migrations.ts`), chạy sau `bootstrap` nên DB vừa bootstrap luôn đạt.
- **FR-005**: `--skipAdminInit` PHẢI bỏ qua `createAdmin` với log `Skipping creation of default Admin user and
  role...`.
- **FR-006**: Mọi dòng log của `bootstrap` PHẢI cùng mức và cùng nội dung với Directus, trừ chữ Directus đổi thành
  Backoffice ở những dòng IX cho phép (D-147); log qua logger pino của 001 (`LOG_LEVEL`, `LOG_STYLE`). "Cùng" nghĩa là:
  với `LOG_STYLE=raw`, chuỗi các cặp (`level`, `msg`) của hai app giống nhau theo thứ tự sau chuẩn hóa FR-107; các
  trường khác của pino (`time`, `pid`, `hostname`, trường thêm) không so. `LOG_STYLE=pretty` không so.
- **FR-007**: `bootstrap` KHÔNG có lock giữa các instance (như Directus; chủ dự án 2026-10-22). Hai lần chạy song song
  trên DB trống thì lần sau lỗi ở seed như Directus.
- **FR-008**: Trên vendor ngoài Postgres và SQLite (theo `getDatabaseClient()`: mọi giá trị khác `postgres` và
  `sqlite`, gồm `redshift`): `bootstrap` với DB trống log lỗi (mức `error`) `Backoffice bootstraps only Postgres and
  SQLite databases; on <client> run "node cli.js bootstrap" with the Directus 11.17.4 image (D-145)` và thoát mã 1
  không ghi gì; với DB đã cài thì log (mức `info`) `Database on <client> is migrated by Directus 11.17.4 (D-145);
  skipping migrations`, `Done`, mã 0 không migrate. `start` không đổi.
- **FR-009**: `createAdmin` dùng bản đã port (010): tạo role, policy, access Administrator; chỉ tạo user khi có
  `ADMIN_EMAIL` và `ADMIN_PASSWORD`; `ADMIN_TOKEN` là `token` của user.
- **FR-010**: `PROJECT_NAME` không rỗng → `SettingsService.upsertSingleton({ project_name })`; `PROJECT_OWNER` là email
  → `setOwner({ project_owner, org_name: null, project_usage: null, product_updates: false })` theo D-38 (không gọi
  `COMPLIANCE_URL`, log cảnh báo, `project_status: null`). Trên DB trống, `setOwner` chạy hai lần như Directus: lần đầu
  trong migration `20251014A-add-project-owner` (`up` gọi `setOwner` khi `PROJECT_OWNER` là email), lần sau ở bước cuối
  của `bootstrap`; cả hai theo D-38. Biến env mà migration port đọc PHẢI được hỗ trợ: `PROJECT_OWNER` rời
  `NOT_APPLICABLE_VARIABLES` vào danh sách hỗ trợ; `ACCEPT_TERMS` (mặc định `false` trong env của Directus, không nằm trong
  danh sách biến Directus nên không bao giờ bị cảnh báo và không cần thêm vào danh sách; `20250609A-license-banner` tạo cột
  `accepted_terms` với default này, `20251014A` xóa cột đó, `down` của `20251014A` tạo lại cột với default này) vào danh
  sách hỗ trợ. DB 11.17.4 sau `latest` không còn cột `accepted_terms`.

**Seed** (port `directus/api/src/database/seeds/run.ts` và 15 file yaml):

- **FR-011**: `database install` và bước cài của `bootstrap` PHẢI tạo bảng từ 15 seed theo thứ tự tên file
  (`01-collections` … `15-migrations`) với đúng kiểu cột, độ dài (`MAX_TABLE_NAME_LENGTH`, `MAX_COLUMN_NAME_LENGTH` theo
  helper schema của vendor), `$now`, default JSON, primary, unique, unsigned, references, cột `geometry*` qua helper
  `st` của vendor; bỏ cột `alias`/`unknown`, như `runSeed`.
- **FR-012**: Dữ liệu 15 seed PHẢI giống nguyên văn Directus 11.17.4 (file đặt cạnh code port, có comment đường dẫn
  gốc); test đơn vị so từng file với bản trong `directus/` để không lệch khi sửa tay.
- **FR-013**: DB đã có `directus_collections` → lỗi `Database is already installed` (install: log lỗi, mã 1).
- **FR-014**: Schema sau seed + 101 migration trên Postgres và SQLite PHẢI giống Directus theo FR-100.
- **FR-015**: Khi `bootstrap`, `database install` hoặc `migrate:*` lỗi giữa chừng (seed tạo một phần bảng, migration hệ
  thống hoặc custom migration ném lỗi), Backoffice PHẢI làm giống Directus: không transaction bao ngoài seed hay
  migration, không kiểm DB cài dở, không tự sửa; lần chạy sau đi đúng nhánh của Directus (`isInstalled()` theo
  `directus_collections`, migration chưa có hàng thì chạy lại). Test parity so hai app trên cùng trạng thái DB cài dở:
  cùng mã thoát và cùng log lỗi sau chuẩn hóa FR-107. Tài liệu (FR-090) PHẢI ghi cách phục hồi: DB mới tạo (seed hoặc
  migration hệ thống lỗi) thì xóa và tạo lại DB rồi chạy lại `bootstrap`; DB có dữ liệu thì khôi phục bản sao lưu;
  custom migration lỗi thì sửa file rồi chạy lại `bootstrap` hoặc `migrate:latest`.
- **FR-016**: Log và output của `bootstrap`, `init` và mọi lệnh CLI KHÔNG ĐƯỢC chứa giá trị của `ADMIN_PASSWORD`,
  `ADMIN_TOKEN`, `DB_PASSWORD`, `SECRET`, `KEY`, kể cả khi lỗi kết nối DB; test parity tìm các giá trị này trong log của
  mọi lần chạy CLI (FR-102).

**Migration** (port `directus/api/src/database/migrations/run.ts` và 101 file):

- **FR-020**: `run(database, 'latest' | 'up' | 'down', log)` PHẢI giữ thuật toán của Directus: đọc migration hệ thống
  (tên khớp `^[0-9]+[A-Z]-[^.]+\.(js|ts)$`) và custom migration ở `MIGRATIONS_PATH` (tên có `-`, đuôi `.js`/`.cjs`/
  `.mjs`); version là phần trước `-` đầu tiên; `name` qua `@directus/format-title` (đã port) từ phần còn lại; sắp theo
  version chuỗi; version trùng → `Migration keys collide! Please ensure that every migration uses a unique key.`.
- **FR-021**: `latest` áp mọi migration chưa `completed` theo thứ tự, mỗi cái log `Applying <name>...` rồi insert
  `{ version, name }` vào `directus_migrations` (cột `timestamp` do DB mặc định); có áp ít nhất một thì
  `flushCaches(true)` một lần sau cùng.
- **FR-022**: `up` áp một migration: migration đầu tiên nếu chưa có hàng nào, nếu không thì migration có version lớn hơn
  version cuối (theo thứ tự `version` của bảng) và `completed === false`; không có → `Nothing to upgrade`, mã 1; sau
  khi áp thì insert hàng và `flushCaches(true)`.
- **FR-023**: `down` gỡ migration có (`timestamp`, `version`) lớn nhất; không có hàng → `Nothing to downgrade`, mã 1;
  không có file → `Couldn't find migration`, mã 1; gọi `down(database)`, xóa hàng theo `version`, `flushCaches(true)`.
- **FR-024**: Migration không export `up`/`down` → cảnh báo `Couldn't find the "up" function from migration <file>` rồi
  lỗi như Directus. Module được nạp bằng `import(file://...)` và `getModuleDefault` (CJS/ESM như Directus).
- **FR-025**: 101 migration hệ thống PHẢI là bản port nguyên văn (cùng tên file, cùng thứ tự): mọi helper chúng gọi
  (`getHelpers`, `getSchema`, `FieldsService`, `SettingsService`, `fetch-permissions`/`fetch-policies`/
  `fetch-roles-tree`, `merge-permissions`, `transaction`, `get-default-index-name`, `@directus/schema`,
  `@directus/utils`, `@directus/constants`) trỏ sang bản đã port của `apps/api`; không migration nào bị sửa logic.
  "Nguyên văn" nghĩa là bản port bằng bản gốc sau đúng hai thay đổi: (1) thêm dòng 1 `// Ported from
  directus/api/src/database/migrations/<file>`; (2) đổi specifier import theo bảng sau, không đổi tên được import:

  | Directus | Backoffice |
  |----------|------------|
  | `@directus/utils`, `@directus/utils/node`, `@directus/schema`, `@directus/env`, `@directus/constants`, `@directus/types` | `@backoffice/` cùng hậu tố |
  | `../../utils/get-schema.js` | `../../schema/get-database-schema.js` |
  | `../../services/fields.js` | `../../services/fields.service.js` |
  | `../../services/settings.js` | `../../services/settings.service.js` |

  Một test so mọi file theo định nghĩa này. Danh sách `DIRECTUS_MIGRATIONS` của 001 PHẢI bằng tập version của thư mục
  này (101), kiểm bằng test.
- **FR-026**: `database install` và `database migrate:*` trên vendor ngoài Postgres và SQLite (như FR-008) PHẢI log lỗi
  `Backoffice runs migrations only on Postgres and SQLite databases; on <client> use the Directus 11.17.4 image (D-145)`
  và dừng mã 1, không ghi gì.
- **FR-027**: `flushCaches(true)` PHẢI xóa cache hệ thống (schema, permissions) và cache dữ liệu trên mọi instance
  Directus và Backoffice qua bus Redis (002, 004, 005) như Directus.

**CLI chung** (port `directus/api/src/cli/index.ts`, `run.ts`, `load-extensions.ts`):

- **FR-040**: Image API PHẢI có `cli.js` ở `/directus` chạy bằng `node cli.js <lệnh>`; cùng cây lệnh, tên option, mô
  tả, giá trị mặc định, `allowExcessArguments` như Directus 11.17.4: `start`, `init`, `security key:generate`,
  `security secret:generate`, `database install`, `database migrate:latest`, `database migrate:up`,
  `database migrate:down`, `users create [--email] [--password] [--role]`, `users passwd [--email] [--password]`,
  `roles create [--role] [--admin] [--app]`, `cache clear [--system] [--data]`, `count <collection>`,
  `bootstrap [--skipAdminInit]`, `schema snapshot [-y] [--format json|yaml] [path]`,
  `schema apply [-y] [-d|--dry-run] [--ignoreRules <value>] <path>`. `--help` của chương trình và của từng lệnh, và lỗi
  của commander khi gọi lệnh hoặc option không tồn tại, PHẢI giống Directus (cùng phiên bản commander) trừ D-147.
- **FR-041**: Mọi lệnh PHẢI trả cùng exit code như Directus trong cùng tình huống (bảng ở US3) và ghi stdout/stderr
  cùng nội dung sau chuẩn hóa FR-107; lỗi không bắt → `console.error` và mã 1.
- **FR-042**: `start` PHẢI là trình tự khởi động hiện tại của `main.js` (001 contracts/startup.md, kể cả dừng khi
  migration lệch). `main.js` vẫn chạy được như trước (ghi đè `command` của 019 không hỏng).
- **FR-043**: Trước khi khai báo lệnh, CLI PHẢI nạp extension như `load-extensions.ts`: bỏ qua nếu không có `DB_CLIENT`,
  DB chưa cài, hoặc còn migration chưa chạy (chỉ xét migration thiếu, như `validateMigrations` boolean của Directus;
  log `Skipping CLI extensions initialization due to outstanding migrations.`); nếu
  nạp thì `initialize({ schedule: false, watch: false })` của manager 020 và phát `cli.before` rồi `cli.after` với
  `{ program }` (gỡ phần CLI của D-141).
- **FR-044**: `--version` và `--help` theo IX (D-147): tên chương trình `backoffice`, phiên bản Backoffice; mô tả lệnh
  giữ chữ của Directus trừ chữ "Directus" ở `start` và `init`.

**Từng lệnh** (port từng file trong `directus/api/src/cli/commands`):

- **FR-050**: `users create`: thiếu email, password hoặc role → log lỗi `Email, password, role are required`, mã 1;
  `UsersService.createOne({ email, password, role, status: 'active' })`; stdout `<id>\n`, mã 0.
- **FR-051**: `users passwd`: thiếu → `Email and password are required`, mã 1; hash bằng `generateHash` (argon2 của
  003), tìm user `LOWER(email) = lower(input)`, update thẳng `directus_users.password`; log `Password is updated for
  user <id>` (mã 0) hoặc `No such user by this email` (mã 1).
- **FR-052**: `roles create`: thiếu `--role` → `Name is required`, mã 1; tạo policy `Policy for <name>` (`admin_access`,
  `app_access`, icon `supervised_user_circle`), role, access; stdout `<roleId>\n`, mã 0.
- **FR-053**: `cache clear`: `CACHE_STORE !== 'redis'` → in thông báo của Directus, mã 0; nếu không: `clearSystemCache({
  forced: true })` khi `--system` hoặc không có cờ, `cache.clear()` khi `--data` hoặc không có cờ; stdout `Cleared
  <all caches | system cache | data cache | system cache and data cache> successfully`, mã 0; lỗi → mã 1.
- **FR-054**: `count <collection>`: `count('*')` trên bảng; stdout `<n>\n`, mã 0; thiếu tham số hoặc lỗi DB → mã 1.
- **FR-055**: `security key:generate` in `randomUUID()`; `secret:generate` in `nanoid(32)`; không xuống dòng, mã 0.
- **FR-056**: `schema snapshot`: `getSnapshot` (006) → yaml (`js-yaml dump`) hoặc JSON; có `path` thì ghi file (hỏi ghi
  đè khi tồn tại và không `-y`; trả lời không → mã 0 không ghi), log `Snapshot saved to <file>`; không `path` thì in
  ra stdout; mã 0.
- **FR-057**: `schema apply`: `validateDatabaseConnection`; DB chưa cài → log lỗi `Backoffice isn't installed on this
  database. Please run "backoffice bootstrap" first.` (Directus: `Directus ... "directus bootstrap"`, D-147) và mã 0
  như Directus; đọc yaml/JSON, `getSnapshotDiff`, lọc `--ignoreRules`; không đổi → `No
  changes to apply.`, mã 0; `--dry-run` hoặc không `-y` → in kế hoạch (Collections, Fields, Relations với
  Create/Update/Delete, `Set <path> to <value>`, `Remove`, `Add`) như `apply.ts`; không `-y` thì hỏi xác nhận; áp bằng
  `applySnapshot` (006), log `Snapshot applied successfully`, mã 0.
- **FR-058**: `database install`: `runSeed`, mã 0; lỗi (kể cả đã cài) → log, mã 1.
- **FR-059**: `database migrate:<direction>`: log `Running migrations...`, chạy FR-020, log `Downgrade successful` hoặc
  `Database up to date`, mã 0; lỗi → log, mã 1.

**`init`** (port `commands/init`, `utils/create-env`, `utils/drivers.ts`, `create-db-connection.ts`):

- **FR-030**: Danh sách vendor của câu hỏi đầu chỉ có `PostgreSQL / Redshift` và `SQLite` (D-146); nhãn
  `PostgreSQL / Redshift` giữ nguyên văn Directus vì nó luôn chọn driver `pg` (`.env` ghi `DB_CLIENT="pg"`), không bao giờ
  ghi `DB_CLIENT=redshift` (client đó bị FR-008 chặn); không chạy `npm install <driver>` và không có spinner
  `Installing Database Driver...`.
- **FR-031**: Câu hỏi kết nối theo `questions.ts` (SQLite: đường dẫn mặc định `<cwd>/data.db`; Postgres: host, port,
  database, user, password, ssl); seed + `migrate latest` (log tắt) tối đa 5 lần như `trySeed`; `.env` ghi từ mẫu
  `env-stub.liquid` đổi thương hiệu (D-147) với `SECRET=nanoid(32)`, `DB_CLIENT`, `DB_*` từ câu trả lời, mode 0640.
- **FR-032**: Admin đầu tiên: hỏi email (mặc định `admin@example.com`, kiểm bằng Joi) và mật khẩu (không rỗng); insert
  thẳng `directus_roles`, `directus_policies`, `directus_access`, `directus_users` với `defaultAdminRole/Policy/User`
  và `randomUUID()`, hash `generateHash`; in hướng dẫn và mã 0.

**Tương thích hai chiều**:

- **FR-035**: DB do Backoffice `bootstrap` hoặc `init` tạo PHẢI để Directus 11.17.4 khởi động không cảnh báo migration
  (log của Directus không có dòng `Database migrations have not all been run` và `/server/health` không `error`),
  đăng nhập, đọc ghi item, `migrate:down`/`latest` được; và ngược lại DB do Directus tạo để Backoffice `bootstrap`
  (chỉ `migrate latest`) và `start` như 001–020.
- **FR-036**: Kiểm tra migration lúc `start` giữ nguyên 001 (thiếu hoặc thừa đều dừng; custom migration ở
  `MIGRATIONS_PATH` và `<EXTENSIONS_PATH>/migrations` được chấp nhận).

**Image** (sửa `apps/api/Dockerfile`, 019):

- **FR-060**: CMD của image API PHẢI chạy `bootstrap` rồi `start` qua `cli.js` dưới `tini` (PID 1), uid 1000, cùng
  `WORKDIR`, `ENV` mặc định (`DB_CLIENT=sqlite3`, `DB_FILENAME=/directus/database/database.sqlite`), cổng 8055 như 019;
  không PM2 (D-19, D-121 sửa). `docker run` không env PHẢI bootstrap SQLite và phục vụ như image Directus.
- **FR-061**: Image PHẢI chứa 15 seed và 101 migration ở vị trí `run.ts` tìm thấy lúc chạy (build swc hiện không copy
  yaml: plan chọn cách).
- **FR-062**: Thư mục `/directus/migrations` PHẢI tồn tại trong image và mount được như `/directus/extensions`; đó là
  nơi mặc định `MIGRATIONS_PATH=./migrations` trỏ tới khi lệnh chạy ở `WORKDIR` `/directus` (CMD, compose, Helm,
  `docker exec` mặc định). Chạy ở thư mục khác thì đường dẫn tương đối giải theo cwd như Directus (Edge Cases).
- **FR-063**: CMD mới PHẢI giữ đạt mọi test hiện có dựa vào image API: các cặp parity (cặp chính trên mọi vendor, các
  profile: Backoffice `depends_on` Directus healthy nên `bootstrap` gặp DB đã cài và không ghi gì; trên MySQL, MSSQL,
  Oracle, CockroachDB thì `bootstrap` bỏ qua theo FR-008), `tests/parity/src/deploy` của 019/020 và kind. Test 019
  `image-swap` "dừng trên DB Directus chưa bootstrap" đổi thành "tự bootstrap DB trống" (Postgres); thứ tự khởi động
  trong `compose.test.ts` (replica sau Directus) giữ.

**Compose** (`deploy/compose`):

- **FR-070**: PHẢI có cách chạy chế độ độc lập (file hoặc override của compose 019): không service `directus`; service
  `bootstrap` (image API, lệnh `node cli.js bootstrap`, cùng env file, cùng volume uploads và migrations) chạy một lần
  sau Postgres, Redis, MinIO healthy; các replica `backoffice-api` `depends_on` nó với
  `condition: service_completed_successfully` và chỉ chạy `start`; FE và lb như 019 nhưng pool chỉ có Backoffice.
- **FR-071**: `docker compose up -d` lại PHẢI chạy lại service `bootstrap` (áp migration mới) trước khi replica khởi động
  lại.
- **FR-072**: Chế độ chung của 019 (và `shared-extensions`, `separate-domain`): replica Backoffice giữ CMD của image
  (`bootstrap` rồi `start`) như một container Directus; không có service `bootstrap` riêng; thứ tự 019 FR-042 (Directus
  bootstrap và healthy trước) giữ nguyên nên `bootstrap` của replica gặp DB đã cài và chỉ `migrate latest`. Custom
  migration mới trong `MIGRATIONS_PATH` có thể được N replica (và các container Directus) áp song song, như N container
  Directus; rủi ro ghi trong tài liệu (chủ dự án 2026-10-22, Q1). Điều kiện trước của 019 FR-024 giữ: DB phải được
  Directus bootstrap trước khi chạy chế độ chung (Edge Cases).
- **FR-073**: `init-env.sh` và tài liệu ghi `ADMIN_EMAIL`/`ADMIN_PASSWORD` là admin được tạo lúc bootstrap (như 019).

**Helm** (`deploy/helm/backoffice`):

- **FR-080**: Chart PHẢI có giá trị `mode`: `shared` (019, mặc định) hay `standalone`. Cả hai chế độ dùng cùng key
  `directus.configMap`, `directus.secret` cho ConfigMap/Secret env; giữ tên có chủ ý để values của 019 dùng lại được và
  vì env vẫn ở định dạng Directus (VIII); tài liệu ghi ở chế độ độc lập đó là env của Backoffice do đội vận hành tạo
  trước. Key mới: `mode`, `bootstrap.backoffLimit`, `bootstrap.activeDeadlineSeconds`, `bootstrap.resources`,
  `migrations.configMap` (contracts/deploy.md).
- **FR-081**: Chế độ độc lập: Job `bootstrap` (hook `pre-install`, `pre-upgrade`, `hook-weight` sau mọi resource hook
  khác, `hook-delete-policy: before-hook-creation` để log còn lại khi lỗi; `parallelism: 1`, `completions: 1` nên các
  lần thử lại theo `backoffLimit` chạy tuần tự, không bao giờ hai pod `bootstrap` cùng lúc; `backoffLimit` và
  `activeDeadlineSeconds` đặt qua values) chạy `node cli.js bootstrap` với cùng image, `envFrom`, cùng
  `securityContext` của pod và container như Deployment (uid/gid 1000, `runAsNonRoot`, `allowPrivilegeEscalation:
  false`, drop `ALL`), `resources` từ `bootstrap.resources` (mặc định bằng `api.resources`), volume uploads và
  migrations như Deployment. Chế độ chung: không có Job (Directus và từng pod Backoffice tự `bootstrap` khi khởi động,
  FR-082).
- **FR-082**: Chế độ độc lập: Deployment PHẢI chạy `start` (không `bootstrap`); install/upgrade chỉ tạo hoặc cập nhật
  Deployment sau khi Job thành công; Job lỗi ở `helm upgrade` → Helm lỗi, release đang chạy không đổi; Job lỗi ở `helm
  install` đầu → release `failed`, không có Deployment, làm lại theo US6 kịch bản 3. Chế độ chung: Deployment dùng CMD
  của image (`bootstrap` rồi `start`) như một Deployment Directus, không đặt `args`; N pod có thể áp cùng custom
  migration song song (Q1, như FR-072); DB phải được Directus bootstrap trước (019 FR-024), NOTES của chart nhắc điều
  này.
- **FR-083**: Chế độ độc lập: kiểm tra install (019 FR-053, 020 FR-045) vẫn chạy trên ConfigMap/Secret; kiểm tra cookie
  domain (019 FR-076) không chạy; ConfigMap hoặc Secret không tồn tại → `fail` với thông báo rõ.
  `apiPool`, `extraPaths` cho Directus là tùy chọn không dùng.
- **FR-084**: `helm template`, kubeconform và kịch bản kind (`ci/kind-test.sh`) PHẢI phủ cả hai chế độ: install độc lập
  từ namespace trống (có ConfigMap/Secret), đăng nhập, upgrade có custom migration qua ConfigMap (FR-085), rolling update
  dưới tải 0 lỗi.
- **FR-085**: `migrations.configMap` nhận tên một ConfigMap chứa custom migration (`.js`/`.cjs`/`.mjs`); chart mount nó
  ở `/directus/migrations` ở cả Job và Deployment, mọi chế độ (Q2). Chart không đặt biến env (019 FR-046), nên khi đặt
  `migrations.configMap` thì `_checks.tpl` PHẢI dừng cài nếu env (ConfigMap/Secret) có `MIGRATIONS_PATH` không trỏ tới
  thư mục đó (giá trị khác `./migrations`, `migrations`, `/directus/migrations`), với thông báo nêu biến và giá trị.
  Không đặt thì không mount; file có sẵn trong image vẫn được đọc. Đổi ConfigMap thì PHẢI `helm upgrade` (Job chạy lại):
  pod mới do HPA tạo sau khi ConfigMap đổi sẽ thấy file chưa chạy và dừng ở `start` (001 D-05) cho tới khi migration
  được áp; chart không phát hiện được việc này lúc chạy, nên NOTES (khi đặt `migrations.configMap`) và tài liệu PHẢI
  ghi "sau khi đổi ConfigMap migration, chạy `helm upgrade` ngay".

**Tài liệu**:

- **FR-090**: `deploy/README.md` PHẢI sửa mục "Lệnh CLI" (chạy bằng image Backoffice), "Thay image Directus bằng
  Backoffice" (không cần `directus bootstrap` trước trên Postgres/SQLite; vendor khác vẫn cần), thêm mục "Chạy độc lập"
  (compose, Helm, Job, migration, giới hạn XI: không email, không WebSocket, SAML, storage ngoài Local/S3), và lưu ý
  chạy `bootstrap` ở một nơi. Mục mới cũng PHẢI có: phiên bản Docker Compose tối thiểu cho override độc lập; phục hồi
  khi `bootstrap` lỗi (DB cài dở, migration lỗi giữa chừng, custom migration lỗi, Helm `install` lỗi; FR-015); cảnh báo
  `migrate:down` migration hệ thống; đổi image sang Backoffice nâng DB lên 11.17.4; điều kiện trước của chế độ chung
  trên DB trống; mount volume cho SQLite; `init` ghi đè `.env`; đổi ConfigMap migration rồi `helm upgrade`.
- **FR-091**: Các dòng sau PHẢI được sửa trỏ sang 021 ở lượt 3: spec 001 dòng D-19 của bảng khác biệt; spec 019 dòng
  D-121, D-123 của bảng khác biệt, US1 kịch bản 4 ("BE dừng và báo thiếu migration"), FR-024 ("DB phải đã được Directus
  bootstrap"), FR-042 (thứ tự khởi động, thêm chế độ độc lập); spec 020 dòng D-141 (bỏ phần CLI); `tests/parity/
  accepted-differences.ts` mục `D-19`, `D-141` (chữ của `reason`).

**Test đối chiếu và chấp nhận** (Nguyên tắc V):

- **FR-100**: Profile parity mới `bootstrap`: hai DB Postgres trống, một do image Directus 11.17.4 bootstrap, một do
  image Backoffice bootstrap, cùng env (`ADMIN_*`, `PROJECT_NAME`, `PROJECT_OWNER`, `COMPLIANCE_URL` trỏ registry giả
  của parity như profile `setup` của 010, để report của Directus gửi thành công và `project_status` vẫn `null` như
  D-38); dump lấy sau khi cả hai app healthy (đã `bootstrap` và `start` lần đầu, kể cả hàng `start` ghi như
  `directus_extensions` của 020). So:
  - schema mọi bảng `directus_*`: tên bảng; mỗi cột: tên, kiểu, nullable, default, độ dài tối đa, precision/scale (theo
    inspector `@backoffice/schema`); khóa chính; khóa ngoại (bảng, cột đích, `on_delete`); index (tên, cột, unique).
    Trên SQLite, kiểu là kiểu khai báo inspector trả về và default là chuỗi như SQLite lưu;
  - hàng của mọi bảng `directus_*` (không loại bảng nào) sau chuẩn hóa FR-107, sắp theo khóa chính;
  - `directus_migrations`: `version`, `name`, thứ tự áp;
  - số owner report registry giả nhận: Directus 2 (migration `20251014A` và `bootstrap`), Backoffice 0 và 2 dòng log
    cảnh báo D-38.

  Cùng bài trên SQLite (hai file do hai image tạo trong cùng volume).
- **FR-101**: Test hai chiều: Directus khởi động, đăng nhập, ghi item trên DB do Backoffice bootstrap; Backoffice
  `bootstrap` + `start` trên DB do Directus bootstrap; `migrate:down` ở bên này, `up` ở bên kia với bộ custom migration
  mẫu (FR-020..FR-024) trên volume `MIGRATIONS_PATH` chung; lỗi trùng version, file không `-`, thiếu `up`.
- **FR-102**: Test CLI: từng lệnh của FR-050..FR-059 và FR-030..FR-032 chạy ở hai image với cùng tham số trên hai DB
  giống nhau; so exit code, stdout, log sau chuẩn hóa FR-107; so tác động lên DB (hàng mới, cache Redis trống sau
  `cache clear`); log và output của mọi lần chạy không chứa giá trị bí mật (FR-016). `init` chạy qua stdin nếu
  `inquirer` 12 đọc được stdin không TTY; nếu không, chạy dưới pseudo-TTY (`script`) — plan chốt cách (research R15, task T058).
- **FR-107**: Chuẩn hóa trước khi so output và log CLI giữa hai app (FR-006, FR-041, FR-102) và hàng DB (FR-100), áp
  đúng các quy tắc sau, không quy tắc nào khác:
  - chữ `Directus` và `Backoffice` → `<app>`; `directus` và `backoffice` khi là tên chương trình hay lệnh (`directus
    bootstrap`, `backoffice [command]`) → `<app>`; `npx directus start` và `node cli.js start` → `<start>` (D-147);
  - phiên bản chương trình (`--version`, dòng phiên bản) → `<version>`;
  - pino raw: chỉ giữ `level` và `msg` (FR-006);
  - uuid → `<uuid:n>`, đánh số theo thứ tự xuất hiện trong mỗi lần chạy; id số tự tăng giữ nguyên;
  - chuỗi `$argon2...` → `<argon2>`; token 64 ký tự của user → `<token>`; chuỗi nanoid 32 của `secret:generate` →
    `<nanoid32>`;
  - thời gian: cột ngày giờ của hàng DB (`date_created`, `timestamp`, `last_access`...) và dấu thời gian trong
    output → `<time>`;
  - đường dẫn tuyệt đối của thư mục tạm của test → `<dir>`;
  - tên biến mà bundler của image Directus đổi trong thông điệp `TypeError` (`up$1 is not a function` → `up is not a
    function`): bỏ hậu tố `$<số>` của tên đứng trước ` is not a function` / ` is not defined`. Thêm khi làm T042
    (2026-10-22, fixture `noup`: cùng cảnh báo, cùng mã 1, chỉ khác tên biến trong bản build của Directus); chờ chủ dự
    án duyệt.
  - khung `Update available!` mà `cli.js` của image Directus in trước mỗi lệnh (`@directus/update-check`, D-149) → bỏ.
    Thêm khi làm T056 (2026-10-22); chờ chủ dự án duyệt.
  Hàm chuẩn hóa nằm ở một chỗ dùng chung cho mọi test của profile `bootstrap`; thêm quy tắc mới PHẢI sửa spec này.
- **FR-103**: Test chấp nhận compose độc lập (`parity-tests:deploy`, thêm cặp hoặc profile): US5 kịch bản 1–3, cộng các
  bài của 019 US3–US6 (sessions, schema, flow theo lịch, TUS, tắt replica) chạy không có Directus trong pool.
- **FR-104**: Test chấp nhận kind (`deploy-k8s`): US6 kịch bản 1–4, giữ các bài 019/020 ở chế độ chung.
- **FR-105**: Test đơn vị cho `run.ts` (port `run.test.ts` của Directus), seed yaml giống bản gốc (FR-012), danh sách
  `DIRECTUS_MIGRATIONS` khớp thư mục (FR-025), vendor không hỗ trợ (FR-008, FR-026).
- **FR-106**: Benchmark và cổng chất lượng của X không đổi; coverage `apps/api` ≥ 80% kể cả thư mục `cli`, `seeds`,
  `migrations/run.ts`. 101 file migration hệ thống được loại khỏi mẫu số coverage (như `src/main.ts` hiện nay), vì
  chúng là bản chép nguyên văn được máy kiểm (FR-025) và được chạy thật ở profile parity `bootstrap` trên Postgres và
  SQLite (FR-100); lý do ghi trong cấu hình coverage. Duyệt (chủ dự án kiêm tech lead, 2026-10-22).

### Key Entities

- **Bảng `directus_migrations`**: `version` (khóa, chuỗi trước `-` của tên file), `name` (tiêu đề từ tên file),
  `timestamp` (mặc định `$now` của DB). Chung với Directus.
- **Migration hệ thống**: 101 file `YYYYMMDDX-ten.ts` của Directus 11.17.4, port nguyên văn, chạy theo version.
- **Custom migration**: file `<version>-<ten>.(js|cjs|mjs)` ở `MIGRATIONS_PATH` (mặc định `./migrations`), export `up`,
  `down`; chung thư mục cho Directus và Backoffice (volume ở compose, ConfigMap mount hoặc file trong image ở
  Kubernetes).
- **Seed**: 15 file yaml `NN-<bang>.yaml` mô tả bảng hệ thống (cột, kiểu, default, khóa).
- **Lệnh CLI**: cây lệnh commander với option, exit code, stdout/log như Directus.
- **Chế độ triển khai**: `shared` (019: cùng DB với Directus; mỗi replica Backoffice chạy CMD của image, `bootstrap`
  rồi `start`, như container Directus; DB phải được Directus bootstrap trước) và `standalone` (021: không Directus;
  `bootstrap` chạy một lần ở service compose hoặc Helm Job, replica chỉ `start`).

## Khác biệt so với Directus *(mandatory)*

Bảng theo mẫu của 020 (cột cuối "Gỡ ở" là cột `guard-differences` đọc; `—` là vĩnh viễn). D-145..D-147 đăng ký trong
`tests/parity/accepted-differences.ts` dạng `doc` (`feature: '021'`). Trạng thái duyệt: D-145, D-146, D-147 duyệt
(chủ dự án kiêm tech lead, 2026-10-22; D-147 chọn ở clarify Q3). Mã D-148 không dùng (DB cài dở làm giống Directus,
FR-015). D-149 đề xuất khi làm lượt 2, chờ duyệt.

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-145 | Vendor được `bootstrap`, `database install`, `database migrate:*` | Postgres, Redshift, CockroachDB, MySQL/MariaDB, SQLite, MSSQL, Oracle | Postgres và SQLite (`getDatabaseClient()` là `postgres` hoặc `sqlite`). Vendor khác, gồm `redshift`: DB trống → lỗi và mã 1, không ghi; DB đã cài → `bootstrap` thoát mã 0 không migrate; `install`, `migrate:*` → mã 1; DB do Directus khởi tạo và migrate | Chủ dự án 2026-10-22; constitution 3.0.0 II | ngoài phạm vi | — |
| D-146 | `init`: danh sách vendor và cài driver | 6 vendor; `npm install <driver> --production` với spinner | Chỉ `PostgreSQL / Redshift` (nhãn giữ nguyên văn, luôn ghi `DB_CLIENT="pg"`) và `SQLite`; không `npm install`, không spinner (driver đã có trong image) | D-145; image không có `npm` ghi được | ngoài phạm vi | — |
| D-147 | Thương hiệu trong CLI | `directus [command] [options]`, `--version` là 11.17.4, log và `.env` mẫu ghi Directus, `init` in `npx directus start`, `schema apply` báo `Directus isn't installed ... "directus bootstrap"` | `backoffice [command] [options]`, `--version` là phiên bản Backoffice, log mới và `.env` mẫu ghi Backoffice, `init` in `node cli.js start`, `schema apply` báo `Backoffice isn't installed ... "backoffice bootstrap"`; giữ nguyên các dòng nêu bảng, migration hay phiên bản Directus (`Installing Directus system tables...`, `Database doesn't have Directus tables installed.`, `... do not match Directus 11.17.4`) và mọi tên bảng, biến, mã lỗi | Nguyên tắc IX; test chuẩn hóa theo FR-107 | đổi thương hiệu | — |
| D-149 | Kiểm phiên bản mới khi chạy CLI | `cli.js` của image gọi `@directus/update-check`: hỏi `https://registry.npmjs.org/directus` (8 s), in khung `Update available!` ra stdout khi có bản mới hơn 11.17.4 | Không kiểm, không gọi registry npm (Backoffice không phát hành qua npm, phiên bản ghim 11.17.4) | Phát hiện khi làm T056 (2026-10-22); đề xuất, chờ chủ dự án duyệt | khác | — |

**Khác biệt của feature trước được sửa hoặc giữ** (dòng tham chiếu; bản sửa nằm ở spec của feature đó, FR-091):

| Khác biệt (feature) | Hiện ghi | Sau 021 |
|---------------------|----------|---------|
| D-19 (001) | Image chạy `node main.js`, không `bootstrap`, không PM2 | `bootstrap` rồi **một** process Node dưới `tini`; không PM2, `PM2_*` bỏ qua; `/metrics` của process đó |
| D-121 (019) | Một process Node dưới `tini`, không `bootstrap` | như D-19 sau 021 |
| D-123 (019) | Image Backoffice không có CLI | gỡ: có CLI (021) |
| D-141 (020) | Không CLI nên không phát `cli.before`/`cli.after` | phần CLI gỡ (FR-043); phần còn lại giữ |
| D-05, D-06 (001) | `start` dừng khi migration lệch | giữ |
| D-38 (010) | `setOwner` không gửi owner report | giữ; nay áp cả cho lần gọi trong migration `20251014A` (FR-010); khi Directus gửi report lỗi, Directus đặt `project_status = 'pending'`, Backoffice luôn `null` |
| XI | Gửi email, WebSocket và realtime, SAML, storage Azure/GCS/Cloudinary/Supabase, theme extension, AI/MCP, deployment module, visual editing, telemetry: không có (D-17, D-24, D-33, D-34, D-36, D-135... giữ) | giữ; khi không có Directus bên cạnh, người dùng mất hẳn các tính năng này |

**Cần xác nhận** (phát sinh khi làm, 2026-10-22): D-149 (không kiểm phiên bản mới khi chạy CLI); hai quy tắc chuẩn
hóa thêm vào FR-107 (tên biến do bundler của image Directus đổi; khung `Update available!`); US5 kịch bản 2 (Compose
không khởi động lại replica khi `bootstrap` chạy lại, đề xuất sửa câu chữ). Tên giá trị Helm chốt ở
FR-080; tên chương trình chốt ở clarify Q3.

## Clarifications

### Session 2026-10-22 (chủ dự án, trước `/speckit.specify`)

- Mục tiêu: **chạy độc lập** (Backoffice tự init DB, migrate, chạy production không cần Directus); Directus chỉ còn là
  mốc test đối chiếu (V). → constitution 3.0.0, US1.
- Phạm vi CLI: **toàn bộ** lệnh của Directus (`bootstrap`, `database`, `users`, `roles`, `cache`, `count`, `schema`,
  `security`, `init`, `start`). → US3, US8, FR-040.
- Nhiều instance cùng bootstrap DB trống: **giống Directus, không lock**. → FR-007, Edge Cases.
- Vendor: **Postgres + SQLite**; các DB khác do Directus init. → D-145, US7.
- Chạy độc lập vẫn **tương thích DB** với Directus 11.17.4 (không thêm bảng, cột, migration riêng). → FR-035,
  constitution II.
- Các mục XI: **giữ ngoài phạm vi**; liệt kê trong bảng khác biệt. → dòng cuối bảng.
- Deploy chế độ độc lập **trong spec 021** (image, compose, Helm). → US5, US6.
- Nâng Directus: **ghim 11.17.4**; nâng phiên bản là feature riêng. → FR-025, Assumptions.
- Helm: **Job tạo pod riêng chạy `bootstrap` trước khi deploy** (không dùng init container, vì N pod vẫn bootstrap song
  song). → FR-081, FR-082.
- `init`: **chỉ hiện vendor Backoffice hỗ trợ**; DB khác thì init bằng Directus. → D-146, FR-030.

### Session 2026-10-22 (`/speckit.clarify`)

- Q: Ở chế độ chạy chung với Directus (compose và Helm của 019), ai chạy `bootstrap`/migration? → A: Giữ CMD của image:
  replica Backoffice chạy `bootstrap` rồi `start` như một container Directus; không có Job/service bootstrap riêng ở chế
  độ chung; N replica có thể áp cùng custom migration song song (như N container Directus). Job/service chạy một lần
  chỉ ở chế độ độc lập. → FR-072, FR-081, FR-082, US5 kịch bản 4, US6 kịch bản 5, Edge Cases; Nguyên tắc VII (3.0.0)
  sửa câu `bootstrap` cho rõ "ở chế độ độc lập".
- Q: Trên Kubernetes (chế độ độc lập), custom migration đến pod bằng cách nào? → A: ConfigMap: values nhận tên một
  ConfigMap chứa các file `.js`, chart mount vào `MIGRATIONS_PATH` ở cả Job và Deployment; file có sẵn trong image vẫn
  được đọc; test kind dùng ConfigMap. → FR-085, FR-084, US6 kịch bản 2, Key Entities, Cần xác nhận.
- Q: Thương hiệu trong CLI: tên chương trình ở `--help`, `--version`, dòng `init` in ra? → A: `backoffice`: `backoffice
  [command] [options]`, `--version` in phiên bản Backoffice, `init` in `node cli.js start`; các dòng nêu bảng hay
  phiên bản Directus giữ nguyên như 001; test chuẩn hóa chữ Directus/Backoffice. → D-147 (duyệt), FR-044, FR-031.

### Session 2026-10-22 (checklist `pre-tasks.md`, chủ dự án)

- CHK003 (DB cài dở): lúc đầu chọn "phát hiện và dừng" (D-148); sau khi xem phương án seed trong transaction, chủ dự án
  chọn lại **làm giống Directus** (không kiểm, không transaction, chỉ tài liệu phục hồi); D-148 bỏ. → FR-015, Edge
  Cases.
- CHK034 (chế độ chung trên DB trống): **giữ điều kiện của 019** (DB do Directus bootstrap trước); NOTES và README ghi.
  → Edge Cases, FR-072, FR-082.
- CHK033 (DB do Directus cũ hơn tạo): **cho phép nâng lên 11.17.4 như image Directus**; tài liệu ghi. → Edge Cases,
  FR-090.
- CHK020 (Redshift): **giữ nhãn `PostgreSQL / Redshift`, chặn `DB_CLIENT=redshift`**. → FR-008, FR-030, D-145, D-146.
- Tác giả tự giải các mục còn lại của checklist (cách giải ghi ngay trong `checklists/pre-tasks.md`).

### Duyệt 2026-10-22 (chủ dự án kiêm tech lead)

- Constitution 3.0.0 (Nguyên tắc II, VII, dòng Reviewer; lý do ghi trong Sync Impact Report giữ nguyên).
- Khác biệt D-145, D-146, D-147; sửa D-19 (001), D-121, D-123 (019), D-141 (020) và các dòng spec 019 ở FR-091.
- Ngoại lệ coverage FR-106 (101 migration ngoài mẫu số).
- Rủi ro chấp nhận: `bootstrap` không lock (FR-007); chế độ chung N replica có thể cùng áp một custom migration (FR-072,
  Q1); chế độ chung cần DB do Directus bootstrap trước (019 FR-024, CHK034); DB cài dở và migration lỗi giữa chừng làm
  giống Directus, chỉ có tài liệu phục hồi (FR-015).

## Assumptions

- Làm trên `main`, không tạo branch (quy ước của dự án).
- Số migration hệ thống là 101 (xem "Điều kiện trước `/speckit.plan`"); Input ghi 103 do đếm nhầm `run.ts`,
  `run.test.ts`.
- `cli.js` là entry mới; `main.js` giữ làm alias của `start` để compose/Helm 019 ghi đè `command` vẫn chạy (FR-042).
- Thư viện CLI (`commander`, `inquirer`, `chalk`, `liquidjs`, `js-yaml`, `nanoid`, `joi`, `uuid`) ghim cùng bản
  Directus 11.17.4 (catalog của `directus/`), trừ bản đã có patch bảo mật trong repo; `execa` và `ora` không cần vì
  `init` không `npm install` (D-146). Plan liệt kê (research R6).
- Build của `apps/api` (swc) không copy yaml: seed và `env-stub.liquid` được copy vào `dist` bằng bước copy của script
  build (research R3); dữ liệu seed vẫn là bản gốc (FR-012).
- Chế độ compose độc lập cần Docker Compose v2.24 trở lên (`!reset` trong file override); `up --wait` với service chạy
  một lần đã thoát mã 0 được plan kiểm ở lượt 1 (research R9, R14) và ghi phiên bản tối thiểu trong tài liệu (FR-090).
- [Unverified] `inquirer` 12 đọc được stdin không TTY cho test `init`; plan kiểm ở lượt 2, dự phòng pseudo-TTY (FR-102).
- Profile parity `bootstrap` có Redis db, namespace và `COMPLIANCE_URL` riêng như profile `setup` (FR-100).
- Migration hệ thống chạy trong Backoffice dùng các helper đã port; nếu plan thấy một helper còn thiếu (chưa port ở
  001–020) thì port thêm theo I, không sửa migration.
- Postgres của compose và parity là image `postgis` (019, 007); seed không cần PostGIS, `validateDatabaseExtensions`
  của 001 vẫn cảnh báo khi thiếu như Directus.
- SQLite chỉ cho một container (image mặc định, `init`, test); compose và Helm chế độ độc lập dùng Postgres.
- Chế độ độc lập không cần `EXTENSIONS_LOCATION` khi một replica; nhiều replica giữ quy tắc 020 FR-045.
- Profile parity cho bootstrap dùng Postgres riêng (như profile `setup` của 010) và Redis db riêng; chạy ở job `parity`
  mỗi PR trên Postgres và SQLite; MySQL không có (D-145).
- Test kind cho chế độ độc lập cần một ConfigMap/Secret tạo bởi `ci/kind-test.sh` từ `init-env.sh` của compose.
- Chủ dự án xem diff constitution 3.0.0 rồi commit cùng spec; trước đó plan vẫn chạy được với bản 3.0.0 đã có trong
  working tree.
- Một đợt `/speckit.tasks` chia ba lượt lên `main` (đề xuất): (1) `bootstrap`, `database install`, `migrate`, seed,
  101 migration, image CMD, parity bootstrap/migration; (2) các lệnh CLI còn lại và `init`, parity CLI; (3) compose và
  Helm chế độ độc lập, test chấp nhận, tài liệu.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Bootstrap DB trống bằng Backoffice và bằng Directus 11.17.4 trên Postgres và SQLite: 0 khác biệt schema và
  0 khác biệt hàng hệ thống sau chuẩn hóa; `directus_migrations` 101 hàng giống `version` và `name` từng hàng.
- **SC-002**: Directus 11.17.4 khởi động trên DB do Backoffice tạo: 0 cảnh báo migration, đăng nhập và ghi item thành
  công trong 100% lần chạy của bộ parity (10 lần liên tiếp trước khi đóng).
- **SC-003**: 16 lệnh/biến thể CLI của FR-040 (không tính `--help`, `--version`, kiểm riêng ở US3 kịch bản 11) có exit
  code giống Directus trong 100% tình huống của US3 và stdout/log giống sau chuẩn hóa FR-107; 0 giá trị bí mật trong
  log (FR-016).
- **SC-004**: Bộ custom migration mẫu: sau mỗi bước `latest`/`up`/`down` ở bất kỳ bên nào, `directus_migrations` và
  schema của hai DB giống nhau (0 khác biệt); cache của mọi instance bị xóa: trước bước đó, `GET /items/<collection mẫu
  của test>` gửi hai lần tới mỗi app cho `x-cache-status: HIT` ở lần hai; ngay sau bước đó, lần gửi đầu tới mỗi app
  cho `MISS`.
- **SC-005**: Từ máy chỉ có Docker và đã có image (không tính thời gian tải image), dựng chế độ độc lập (3 replica,
  không Directus) và đăng nhập qua `/admin` bằng một lệnh, dưới 10 phút trên runner CI; các bài 019 US3–US6 đạt 100%
  trong 10 lần chạy liên tiếp của `parity-tests:deploy` với `DEPLOY_MODE=standalone` trước khi đóng feature.
- **SC-006**: Trên kind: `helm install` chế độ độc lập từ namespace chỉ có ConfigMap/Secret → pod Ready và đăng nhập
  được; `helm upgrade` có custom migration mới: migration áp đúng 1 lần, 0 request lỗi trên ít nhất 5.000 request gửi
  liên tục trong suốt lần upgrade (như 019 SC-002, SC-003); Job lỗi giả lập làm upgrade dừng và release cũ còn nguyên.
- **SC-007**: `docker run` image API không env: `/server/ping` trả 200 trong dưới 60 giây kể từ khi container khởi động;
  file SQLite giống file do image Directus tạo (SC-001).
- **SC-008**: Trên MySQL (parity hiện có): `bootstrap` với DB trống dừng mã 1 không tạo bảng; container Backoffice trên
  DB do Directus bootstrap khởi động như trước (các bài parity MySQL của 001–020 không đổi kết quả).
- **SC-009**: Coverage `apps/api` ≥ 80% sau khi thêm `cli`, `seeds`, `migrations/run.ts` (101 migration loại theo
  FR-106); CI xanh ở mọi job hiện có cộng job mới của FR-100..FR-104.
- **SC-010**: `bootstrap` trên DB trống (seed + 101 migration + admin) xong trong dưới 2 phút trên runner CI, cả Postgres
  và SQLite; đo ở profile `bootstrap` mỗi lần chạy CI. Giá trị mặc định `bootstrap.activeDeadlineSeconds` (600) và
  healthcheck/startup probe của compose và chart chọn theo số này (ít nhất gấp 3).
