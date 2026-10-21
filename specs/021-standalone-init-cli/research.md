# Research: Chạy độc lập (021)

Khảo sát 2026-10-22 trên `main` (HEAD `48292233`), bằng ba lượt rà soát: import của 101 migration, hạ tầng test và
deploy, cách build và service của `apps/api`. Đường dẫn `directus/...` là bản Directus 11.17.4 chỉ đọc. Chỗ chưa chạy
thử ghi "[Unverified]".

## R1. CLI: cấu trúc, cách gọi service, điểm vào

- **Decision**: `apps/api/src/cli/` port nguyên cây `directus/api/src/cli/` (`index.ts` `createCli`, `run.ts`,
  `load-extensions.ts`, `commands/{bootstrap,cache,count,database,init,roles,schema,security,users}`,
  `utils/{create-db-connection,create-env,drivers}`), header `// Ported from ...` từng file, ghi vào
  manifest theo task `tools/port-manifest/021-T###.json` (quy ước của repo, như `002-T005.json`). Lệnh gọi service bằng `new UsersService({ schema, knex })` như Directus, **không**
  dùng `NestFactory.createApplicationContext`. Điểm vào trong package: `apps/api/cli.js` (gốc package, `#!/usr/bin/env
  node`, `import('./dist/cli/run.js')`), thêm vào `files` và `bin: { backoffice: 'cli.js' }`; trong image là
  `/directus/cli.js`, cùng dòng lệnh `node cli.js <lệnh>` ở `WORKDIR /directus` như image Directus (ở Directus,
  `cli.js` nằm ở gói `directus/directus/cli.js` và gọi `@directus/api/cli/run.js`).
- **Rationale**: mọi service của `apps/api` là class thường với `constructor(options: AbstractServiceOptions)` (không
  `@Injectable`); Nest chỉ bọc chúng bằng factory trong `src/providers.ts`, và `utils/create-admin.ts`, `auth/auth.ts`
  đã `new RolesService({ schema })` ngoài Nest. `getDatabase`, `getCache`, `useBus`, `useLock` là singleton lười, không
  cần Nest. Mọi lệnh Directus kết thúc bằng `database.destroy()` và `process.exit()`, nên kết nối Redis (lock/bus của
  `getSchema()`, Keyv) không giữ process sống. `start` không import `server.ts` cho tới khi cần (như `main.ts`), nên các
  module có tác dụng phụ lúc nạp (`services/graphql/schema-cache.ts` subscribe bus, `schedules/metrics.ts`, rate limiter)
  không chạy ở lệnh khác.
- **Alternatives**: `NestFactory.createApplicationContext(AppModule)` (bị loại: nạp toàn bộ module, extension manager,
  flow manager; chậm và mở kết nối không cần); để CLI trong `apps/api/src/main.ts` theo `process.argv` (bị loại: khác cây
  file Directus, khó so test).
- Chi tiết từng lệnh và chuỗi thương hiệu: [contracts/cli.md](./contracts/cli.md).

## R2. `start`, `main.js`, CMD của image

- **Decision**: `commands/start.ts` (file mới, Directus gọi thẳng `startServer` của `server.ts`) chạy đúng `main.ts`:
  `logUnhandledRejections()`, `await runStartupChecks()`, `await import('../../server.js')`, `startServer()`. `main.ts`
  giữ nguyên (alias cho `command`/`args` ghi đè của 019). Dockerfile: `CMD ["/bin/sh", "-c", "node cli.js bootstrap &&
  exec node cli.js start"]`, `ENTRYPOINT` `tini` giữ nguyên.
- **Rationale**: `exec` để sau `bootstrap`, Node là con trực tiếp của `tini` (test `image-swap.test.ts` "tini PID 1, node
  là con" giữ nguyên); `bootstrap` thoát khác 0 thì `sh` thoát mã đó và không `start` (FR-001). Directus dùng CMD dạng
  shell không `exec` (PID 1 là `sh`, D-121); ta giữ `tini` (D-19 sửa).
- **Alternatives**: `start` tự gọi `bootstrap` khi `BACKOFFICE_BOOTSTRAP=true` (bị loại: biến mới, trái VIII và khác
  Directus); init container trong Helm (bị loại: Q của clarify, N pod vẫn bootstrap song song).

## R3. Seed: 15 file yaml vào `dist`

- **Decision**: chép 15 file `directus/api/src/database/seeds/*.yaml` vào `apps/api/src/database/seeds/` nguyên văn,
  thêm dòng 1 `# Ported from directus/api/src/database/seeds/<file>` (theo `tools/check-port-headers.mjs`); port
  `seeds/run.ts` (đọc thư mục `__dirname`, bỏ file bắt đầu bằng `run`, nên phải bỏ cả `run.test.ts`: Directus không có
  test cho seed, ta đặt test ở `seeds/__tests__/`? Không: swc `--ignore '**/*.test.ts'` đã loại test khỏi `dist`, và
  `readdir` chạy trên `dist`, nên `run.test.ts` cạnh `run.ts` vẫn ổn). Build: thêm bước copy asset vào script `build`
  của `apps/api/package.json` theo đúng tiền lệ `libs/system-data`: `node -e "require('fs').cpSync('src','dist',
  {recursive:true,filter:(s)=>/\.(yaml|liquid)$/.test(s)||require('fs').statSync(s).isDirectory()})"`. Test FR-012:
  `seeds/run.test.ts` so từng file với bản trong `directus/` sau khi bỏ dòng header (như
  `directus-11.17.4.test.ts` đang đọc thư mục `directus/`).
- **Rationale**: swc không copy file ngoài TS (`@swc/cli` chỉ copy với `--copy-files`, build không bật); Directus cũng
  copy bằng `copyfiles "src/**/*.{yaml,liquid,md}"`. Giữ yaml nguyên văn để FR-012 so byte; không thêm dependency.
- **Alternatives**: chuyển seed sang module TS (bị loại: không so byte được với bản gốc, sửa tay dễ lệch); thêm
  `copyfiles` (bị loại: thêm dependency cho một dòng).

## R4. 101 migration: port nguyên văn và các chỗ còn thiếu

- **Decision**: chép 101 file `directus/api/src/database/migrations/2*.ts` vào `apps/api/src/database/migrations/` (cạnh
  `directus-11.17.4.ts`), mỗi file thêm dòng 1 `// Ported from directus/api/src/database/migrations/<file>` và chỉ đổi
  specifier import theo bảng sau; phần còn lại giữ từng ký tự. Một test `migrations/port.test.ts` đọc từng cặp file,
  bỏ dòng header, áp bảng thay thế rồi so bằng nhau (FR-025 "nguyên văn" được máy kiểm), và so danh sách version của thư
  mục với `DIRECTUS_MIGRATIONS` (101, `20201028A` … `20260211A`).

  | Specifier Directus | Specifier Backoffice | Số file |
  |--------------------|----------------------|---------|
  | `@directus/utils` | `@backoffice/utils` | 14 |
  | `@directus/utils/node` | `@backoffice/utils/node` | 1 |
  | `@directus/schema` | `@backoffice/schema` | 4 |
  | `@directus/env` | `@backoffice/env` | 2 |
  | `@directus/constants` | `@backoffice/constants` | 2 |
  | `@directus/types` | `@backoffice/types` | 4 (type-only) |
  | `../../utils/get-schema.js` | `../../schema/get-database-schema.js` (`getSchema` cùng tên, cùng chữ ký) | 4 |
  | `../../services/fields.js` | `../../services/fields.service.js` | 2 |
  | `../../services/settings.js` | `../../services/settings.service.js` | 1 |

  Các specifier còn lại (`knex`, `../helpers/index.js`, `../index.js`, `../../logger/index.js`,
  `../../utils/transaction.js`, `../../utils/get-default-index-name.js`, `../../permissions/lib/fetch-*.js`,
  `../../permissions/utils/merge-permissions.js`, `lodash-es`, `node:crypto`, `node:path`, `node:url`, `zod`,
  `import('nanoid')`) đã có cùng đường dẫn và cùng export.
- **Còn thiếu, phải thêm** (4 việc nhỏ, đều port từ Directus):
  1. `processChunk` → `libs/utils/src/shared/process-chunk.ts` (port 11 dòng của
     `directus/packages/utils/shared/process-chunk.ts`, re-export ở `shared/index.ts`); dùng ở `20240806A`.
  2. `SettingsModuleBarLink`, `SettingsModuleBarModule` → `libs/types/src/settings.ts` (port từ
     `directus/packages/types/src/settings.ts:3-18`); dùng ở `20250224A`.
  3. `uuid` 11.1.0 (đã có trong catalog gốc, bằng Directus) vào `dependencies` của `apps/api`; dùng ở `20250613A`
     (`v7 as uuid`).
  4. Type `Migration` → `apps/api/src/types/migration.ts` (`{ version: string; name: string; timestamp: Date }`), cho
     `run.ts`.
- **Helper schema**: 101 migration chỉ dùng `getHelpers(knex).schema` với `changeToType` (41), `isOneOfClients` (8),
  `getColumnNameMaxLength`, `getTableNameMaxLength` (5), `changePrimaryKey`, `createIndex`, `generateIndexName` (2);
  cả bảy có ở `apps/api/src/database/helpers/schema/types.ts`, bản port giống Directus (`mysql.ts`, `postgres.ts`,
  `cockroachdb.ts` chỉ khác chỗ gọi `useEnv()` trong hàm).
- **`20240204A-marketplace`** dùng `resolvePackage(name, __dirname)` với `__dirname` của file: trong image là
  `/directus/dist/database/migrations`, cùng độ sâu với Directus (`/directus/dist/database/migrations` của
  `@directus/api`? Directus: `node_modules/@directus/api/dist/database/migrations`, `resolvePackage` đi lên tới
  `node_modules` chứa gói; ở ta `/directus/node_modules`). [Unverified] cho tới T-task chạy bootstrap thật; migration này
  chỉ phân loại extension đã cài, DB trống không có hàng nên không ảnh hưởng bootstrap.
- **Nhánh theo vendor** (`isOneOfClients`, `getDatabaseClient() === 'mysql'`): giữ nguyên code; chỉ Postgres và SQLite
  được chạy (D-145), nhánh MySQL/Oracle/Cockroach không bao giờ chạy trong Backoffice.
- **Rationale**: Nguyên tắc I, II (3.0.0): migration là bản port nguyên văn; mọi helper đã có từ 001–020.
- **Alternatives**: viết lại migration gọn hơn (bị loại: trái II); tạo schema thẳng từ snapshot (bị loại: khác thứ tự và
  dữ liệu `directus_migrations`).

## R5. `run.ts`, kiểm tra migration và cổng vendor

- **Decision**: port `migrations/run.ts` nguyên văn (đổi `@directus/env` → `@backoffice/env`, `@directus/format-title`
  → `@backoffice/format-title`, `../../cache.js` `flushCaches` đã có, `getModuleDefault` đã có); port `run.test.ts`
  (8 test, `knex-mock-client` đã có ở `apps/api/src/test-utils`). `validate-migrations.ts` của 001 giữ nguyên cho
  `start`; thêm `migrationsValid(): Promise<boolean>` (dựa trên `checkMigrations`, `missing.length === 0` như
  `validateMigrations` boolean của Directus) cho `cli/load-extensions.ts`. Cổng vendor D-145 nằm ở CLI:
  `cli/utils/assert-vendor.ts` `assertBootstrapVendor(mode: 'install' | 'migrate')` với `getDatabaseClient()` ∈
  `['postgres', 'sqlite']` (mọi giá trị khác, kể cả `redshift` của `Client_Redshift`, bị chặn); `bootstrap` gọi nó sau
  `waitForDatabase`: DB trống và vendor khác → log lỗi, mã 1; DB đã cài và vendor khác → log `Database on <client> is
  migrated by Directus 11.17.4 (D-145); skipping migrations`, `Done`, mã 0 không migrate; `database install`,
  `migrate:*` → mã 1. Câu chữ cố định ở spec FR-008, FR-026.
- **DB cài dở, lỗi giữa chừng (spec FR-015)**: giống Directus. Không transaction bao seed hay migration, không kiểm
  bảng thiếu, không tự sửa; chỉ tài liệu phục hồi. Chủ dự án chọn sau khi xem ba phương án (kiểm và dừng = D-148 cũ; seed
  trong transaction; tự xóa và cài lại).
- **Rationale**: `run.ts` và `seeds/run.ts` không biết vendor (giữ nguyên văn); gác ở lệnh là chỗ duy nhất Backoffice khác
  Directus (D-145). Nhãn `PostgreSQL / Redshift` của `init` luôn ghi `DB_CLIENT="pg"` nên không mâu thuẫn với cổng
  (chủ dự án, checklist CHK020).
- **Alternatives**: gác trong `run.ts` (bị loại: sửa file port); cho phép MySQL vì code Knex chung (bị loại: chủ dự án
  chọn phạm vi Postgres + SQLite; không có cặp parity MySQL cho bootstrap).

## R6. Các lệnh còn lại và phần phụ trợ

- **Decision**:
  - `commands/schema/apply.ts` cần `applySnapshot`: port `directus/api/src/utils/apply-snapshot.ts` (10 dòng:
    `getSchema`, `getSnapshot`, `getSnapshotDiff`, `applyDiff`, `flushCaches`) vào `apps/api/src/utils/apply-snapshot.ts`
    (006 chưa port vì controller `/schema/apply` gọi `applyDiff` thẳng).
  - `commands/init`: `drivers.ts` chỉ còn `pg` và `sqlite3` (D-146); bỏ `execa` + `ora` (không `npm install`);
    `create-env/env-stub.liquid` chép rồi đổi thương hiệu (D-147), header dòng 1 là comment Liquid `{%- comment -%}Ported
    from ...{%- endcomment -%}` để không in ra `.env`, copy vào `dist` theo R3; `questions.ts`,
    `create-db-connection.ts` nguyên văn (nhánh mssql/cockroach không chạy nhưng giữ để diff sạch).
  - `commands/bootstrap`: nguyên văn + `assertBootstrapVendor` (R5) + log thương hiệu (D-147).
  - `PROJECT_OWNER` rời `NOT_APPLICABLE_VARIABLES`, vào `SUPPORTED_VARIABLES` (nhóm "Feature 021"); `ACCEPT_TERMS`
    (mặc định `false` trong `libs/env`, đọc bởi `20250609A` và `down` của `20251014A`) vào `SUPPORTED_VARIABLES`.
  - `cli/load-extensions.ts`: `getExtensionManager().initialize({ schedule: false, watch: false })` như Directus; hook
    `schedule` của extension vẫn tạo `CronJob` trong `initialize` (như Directus, callback kiểm `schedule`), process thoát
    bằng `process.exit` nên không treo.
- **Dependency mới** (ghim bản của catalog Directus 11.17.4, thêm vào catalog gốc `pnpm-workspace.yaml`):
  `commander` 14.0.2, `inquirer` 12.11.0 (ESM, tự có `.d.ts`, không cần `@types/inquirer`), `chalk` 5.6.2, `liquidjs`
  10.27.2 (bản vá bảo mật; Directus 11.17.4 có 10.25.7 dính GHSA-gf2q-c269-pqgc critical và 4 high, `pnpm audit --prod
  --audit-level=high` của CI chặn); `uuid` 11.1.0 (R4). Không thêm `ora`, `execa` (D-146), `copyfiles` (R3). `nanoid` 5.1.16, `joi` 18.2.6,
  `js-yaml` 4.3.2 giữ bản đã vá bảo mật của repo (khác Directus, đã ghi ở 010/013). `inquirer` 12 là ESM-only như
  `apps/api` (`"type": "module"`).
- **Rationale**: giữ cây file của Directus để test đối chiếu so từng lệnh; dependency đúng bản để prompt, màu và cú pháp
  option giống.

## R7. Thương hiệu trong CLI (D-147, clarify Q3)

- **Decision**: đổi: `program.name('backoffice')`, usage `backoffice [command] [options]`, `program.version(
  BACKOFFICE_VERSION)`, mô tả `start` ("Start the Backoffice API") và `init` ("Create a new Backoffice Project"),
  `init` in `Start Backoffice by running:` và `node cli.js start` (thay `npx directus start`), `.env` mẫu (chữ Directus và
  link docs → Backoffice), `schema apply`: `Backoffice isn't installed on this database. Please run "backoffice
  bootstrap" first.`. Giữ: `Installing Directus system tables...`, `Database doesn't have Directus tables installed.`
  (001), mọi tên bảng, biến, mã lỗi, tên lệnh. Bộ chuẩn hóa parity (`tests/parity/src/bootstrap/normalize.ts`): thay
  `Directus|Backoffice` → `<app>`, `npx directus start|node cli.js start` → `<start>`, số phiên bản → `<version>`,
  thời gian pino, pid, hostname, uuid, hash.
- **Rationale**: Nguyên tắc IX cho đổi tên hiển thị và log; 001 giữ các dòng nêu bảng Directus.

## R8. Profile parity `bootstrap` (Postgres và SQLite)

- **Decision**: profile mới `bootstrap` trong `tests/parity/docker-compose.yml` + `scripts/env.mjs` `ALL_PROFILES` +
  `src/docker.ts` `compose()` + `config.ts` `profilePorts.bootstrap = { directus: 10755, backoffice: 10756 }`,
  `bootstrapDbPort = 6114`, `bootstrapCrossPort = 10757`:
  - `postgres-bootstrap` (`postgis/postgis:13-3.4-alpine`, cổng 6114, init SQL tạo bốn DB `directus_bootstrap`,
    `backoffice_bootstrap`, `directus_partial`, `backoffice_partial` qua `/docker-entrypoint-initdb.d`).
  - `directus-bootstrap`: image Directus, `DB_DATABASE=directus_bootstrap`; `backoffice-api-bootstrap`: image API (CMD
    mặc định: bootstrap rồi start), `DB_DATABASE=backoffice_bootstrap`; **không** `depends_on` nhau (mỗi bên tự
    bootstrap). Env chung `env/profile-bootstrap-<vendor>.env`: `ADMIN_EMAIL`/`ADMIN_PASSWORD` có giá trị (để so
    `createAdmin` đầy đủ), `PROJECT_NAME`, `PROJECT_OWNER=owner-bootstrap@example.com`, `LOG_STYLE=raw`, `CACHE_*`,
    `COMPLIANCE_URL`; phần riêng từng service trong `environment:` (DB, `PUBLIC_URL`, Redis db, namespace,
    `MIGRATIONS_PATH: ${BOOTSTRAP_MIGRATIONS_DIR:-/directus/migrations}`). Hai DB khác nhau PHẢI có Redis db và namespace
    khác nhau (`parity-bootstrap-d` db 10, `parity-bootstrap-b` db 11), vì khóa cache chỉ phụ thuộc request
    (`get-cache-key.ts`) và pub/sub bỏ qua số db (analyze I1); bind `./fixtures/migrations:/directus/migrations:ro`.
  - `directus-on-backoffice-db`: image Directus trên `backoffice_bootstrap`, cùng Redis db và namespace với
    `backoffice-api-bootstrap`, `depends_on backoffice-api-bootstrap healthy`, cổng 10757 (FR-035 chiều Directus trên DB
    của Backoffice: khởi động, đăng nhập, ghi item).
  - Cô lập (analyze U2): `cross`, `cli`, `partial`, `init` ghi vào DB và Vitest không cố định thứ tự file, nên trạng thái
    ngay sau bootstrap (dump hai DB, log khởi động, số owner report theo `project_owner`) được chụp một lần trong
    `global-setup.ts` qua `src/bootstrap/baseline.ts` vào `.data/bootstrap/baseline.json`; `schema.test.ts` chỉ đọc file
    này. Registry giả đếm thêm theo `project_owner` (`GET /v1/owner?project_owner=`).
  - SQLite (`TEST_DB=sqlite3`): `env_file: ./env/profile-bootstrap-${TEST_DB:-postgres}.env` chọn `DB_CLIENT=sqlite3`,
    `DB_FILENAME` của từng service (`environment:`) là `/directus/database/bootstrap/{directus,backoffice}.db` trên bind
    mount `./.data/bootstrap`; host đọc hai file bằng knex sqlite3. Compose nội suy biến trong đường dẫn `env_file` (như
    `x-app` đang dùng `${TEST_DB:-postgres}`).
  - Test `src/bootstrap/`: `dump.ts` (schema qua `createInspector` của `@backoffice/schema`: `columnInfo`, `primary`,
    `foreignKeys`, `indexesOf` của `db-snapshot.ts`; hàng `select *` mọi bảng `directus_*` sắp theo khóa, chuẩn hóa
    `comparable()` của `src/system/helpers.ts` + ánh xạ uuid theo thứ tự xuất hiện → `<role:1>`...), `schema.test.ts`
    (FR-100), `cross.test.ts` (FR-035, FR-101: đăng nhập ở 10757, ghi item, `migrate:down`/`up` chéo), `cli.test.ts`
    (FR-102: helper `cli(service, args, env?) → { code, stdout, stderr }` bằng `execFileSync('docker', ['compose', ...,
    'exec', '-T', '-e', ..., service, 'node', 'cli.js', ...])` bắt `status`; so sau chuẩn hóa R7), `init.test.ts` (FR-032
    qua stdin vào `compose exec -T -i`). Bộ migration mẫu `tests/parity/fixtures/migrations/{ok,collide,nodash,noup}/`:
    `ok` có 3 file (tạo bảng, thêm cột có default, migration trong `transaction`); `MIGRATIONS_PATH` chọn thư mục con qua
    `-e` của `compose exec` (lệnh CLI) hoặc biến `BOOTSTRAP_MIGRATIONS_DIR` khi tạo lại container (`bootstrap` lúc khởi
    động; analyze U4).
  - Suite: thêm `src/bootstrap/**/*.test.ts` vào `FULL_FILES` và `REDUCED_FILES` (test tự skip khi không có
    `profileUrls('bootstrap')`); CI job `parity`: thêm `bootstrap` vào `--profiles` của postgres (2 shard) và sqlite3.
- **Rationale**: profile `setup` (010) là mẫu gần nhất (Postgres riêng, Redis db riêng, namespace riêng); `db-snapshot.ts`
  chỉ cho checksum nên cần dump hàng; không có cặp parity nào chạy hai DB riêng nên profile mới là bắt buộc.
- **Alternatives**: hai container Postgres (bị loại: RAM runner); so bằng `pg_dump` text (bị loại: không chạy cho SQLite,
  khó chuẩn hóa uuid).

## R9. Compose chế độ độc lập

- **Decision**: file override `deploy/compose/docker-compose.standalone.yml` dùng chung `docker-compose.yml`:
  `directus: { profiles: [shared-only] }` (tắt service, không cần xóa), service mới `bootstrap` (image API,
  `command: ["node", "cli.js", "bootstrap"]`, `restart: "no"`, `env_file: ${DEPLOY_ENV_FILE:-.env}` ghi thẳng vì anchor
  `*app-env` của file gốc không dùng được ở file override, volume `migrations:/directus/migrations`),
  `backoffice-api`: `command: ["node", "cli.js", "start"]`, `depends_on: !reset` rồi `{ bootstrap: { condition:
  service_completed_successfully }, redis: ..., minio-init: ... }`, volume `migrations`; `lb`: mount
  `./lb/standalone.conf` (`api_pool` chỉ `backoffice-api`, không có `server directus:8055`: nginx không khởi động được
  khi host không có); volume mới `migrations`. Lệnh: `docker compose -f docker-compose.yml -f docker-compose.standalone.yml
  up -d --wait`. Không đặt `MIGRATIONS_PATH` ở đâu cả: mặc định `./migrations` ở `WORKDIR /directus` đã là
  `/directus/migrations`, nơi mount volume; env chỉ đến từ `.env` (VIII, spec FR-070; analyze U1, I3).
- **Rủi ro [Unverified]**: `docker compose up --wait` với service một lần đã thoát mã 0: compose v2 (≥ 2.17) coi
  container `exited (0)` của service có `depends_on ... service_completed_successfully` là xong; T-task kiểm trên Docker
  của máy dev và runner; dự phòng: tài liệu dùng `docker compose run --rm bootstrap` rồi `up -d --wait`.
- **Test**: `tests/parity/src/deploy/instances.ts` thêm `STANDALONE = DEPLOY_MODE === 'standalone'` (như `SEPARATE`),
  `composeArgs` thêm `-f docker-compose.standalone.yml`; `smoke`/`compose.test.ts` nhánh standalone (không `directus`,
  `bootstrap` ExitCode 0, replica `StartedAt` sau `FinishedAt` của bootstrap, lb trải trên đúng `REPLICAS` upstream);
  `image-swap.test.ts` "stops on a database Directus never bootstrapped" đổi thành "bootstraps an empty database" (chờ
  healthy, đăng nhập, `directus_migrations` 101 hàng); `standalone.test.ts` mới: thêm file migration vào volume bằng
  `docker compose cp`, `up -d` lại, kiểm hàng mới và `x-cache-status` MISS. CI job `deploy` chạy thêm lượt
  `DEPLOY_MODE=standalone`.
- **Rationale**: chủ dự án chọn override riêng; compose `profiles` trong override là cách tắt service không sửa file gốc;
  `!reset` (compose spec 2.24+, Docker Desktop hiện tại) để thay `depends_on`.
- **Alternatives**: file compose độc lập hoàn toàn (bị loại: chép 150 dòng); giữ `depends_on directus` và chạy Directus
  profile rỗng (bị loại: vẫn có Directus).

## R10. Helm: chế độ, Job, ConfigMap migration, kiểm tra

- **Decision** (giá trị ở [contracts/deploy.md](./contracts/deploy.md)): `mode: shared` (mặc định, 019) | `standalone`;
  `bootstrap.backoffLimit: 3`, `bootstrap.activeDeadlineSeconds: 600`; `migrations.configMap: ''`.
  - `templates/bootstrap-job.yaml` chỉ khi `standalone`: `batch/v1 Job`, annotations `helm.sh/hook: pre-install,
    pre-upgrade`, `helm.sh/hook-weight: "10"`, `helm.sh/hook-delete-policy: before-hook-creation` (Job cũ còn lại để xem
    log, bị thay ở lần hook sau); pod `restartPolicy: Never`, cùng image, `envFrom`, `securityContext` 1000, volume
    uploads (nếu có) và migrations; `command: ["node", "cli.js", "bootstrap"]`.
  - `api-deployment.yaml`: khi `standalone` thêm `args: ["node", "cli.js", "start"]` (ENTRYPOINT `tini` giữ); khi
    `shared` không đặt (CMD image: bootstrap rồi start, Q1). Volume `migrations` từ `migrations.configMap` mount
    `/directus/migrations` ở cả Job và Deployment khi đặt (Q2).
  - `_checks.tpl`: `standalone` → `lookup` ConfigMap/Secret trả rỗng khi cài thật → `fail` "ConfigMap <name> not found:
    create it before `helm install`" (019 chỉ `required` tên); bỏ kiểm cookie domain (`domain.publicUrl` chỉ cho chế độ
    chung); các kiểm FR-053 (Redis, `*_STORE`, `SECRET`, `DB_CLIENT`, storage) và 020 FR-045 giữ. ConfigMap/Secret do đội
    vận hành tạo trước nên không cần hook weight cho chúng (prompt plan nêu "weight nhỏ hơn Job" chỉ áp dụng nếu chart tự
    tạo; spec FR-080 không).
  - `NOTES.txt`: nhánh standalone (không có hướng dẫn gắn nhãn pool Directus).
  - `ci/test-template.sh`: render thêm `--set mode=standalone --set migrations.configMap=mig`; đếm `secretRef` 2 ở
    standalone (Deployment + Job), 1 ở shared; `hook` annotations có mặt chỉ ở standalone. `ci/kind-test.sh`: thêm
    namespace `bo-standalone` với ConfigMap/Secret từ `ci/deps-standalone.yaml` (không có Deployment Directus, DB
    `backoffice`), ConfigMap `migrations` từ `tests/parity/fixtures/migrations/ok/` (1 file), `helm install bo-sa
    --set mode=standalone ... --wait`, đăng nhập qua Traefik host `bo.test`, kiểm `directus_migrations` (kubectl exec
    psql) = 101 + 1, `kubectl create configmap migrations --from-file` thêm file thứ hai rồi `helm upgrade` dưới tải
    (`ci/load.mjs`) → +1 hàng, 0 lỗi; Job lỗi giả lập: `helm upgrade --set bootstrap.activeDeadlineSeconds=1`? (không
    chắc lỗi kịp) → dùng ConfigMap có migration ném lỗi (`fixtures/migrations/fail/`) rồi mong `helm upgrade` lỗi và
    `kubectl rollout status` của Deployment cũ không đổi.
- **Rationale**: Nguyên tắc VII (3.0.0) với chế độ độc lập; hook `pre-upgrade` chạy trước khi Deployment đổi nên pod cũ
  vẫn phục vụ (0 lỗi); ConfigMap mount để test kind không build image mới (Q2).
- **Alternatives**: `post-install` Job (bị loại: Deployment khởi động trước khi DB có bảng → crashloop); init container
  (bị loại: Q1 của clarify); chart tạo ConfigMap/Secret từ values (bị loại: mở đường khai báo lại biến, 019 FR-046).

## R11. Tài liệu, spec cũ và `accepted-differences.ts`

- **Decision**: `deploy/README.md`: sửa "Thay image Directus bằng Backoffice" (Postgres/SQLite không cần `directus
  bootstrap`), "Lệnh CLI" (lệnh qua image Backoffice, bảng giữ nguyên nội dung lệnh), thêm "Chạy độc lập" (compose, Helm,
  Job, ConfigMap migration, cảnh báo chạy `bootstrap` ở một nơi, chế độ chung N replica cùng migrate, giới hạn XI).
  `tests/parity/README.md` thêm mục profile `bootstrap`. `tests/parity/accepted-differences.ts`: sửa chữ của `D-19`
  (001, `doc`) và `D-141` (020); spec 001 D-19, spec 019 D-121/D-123 (và US1 kịch bản 4, FR-024, FR-042), spec 020 D-141
  sửa dòng trỏ 021 (danh sách dòng ở spec FR-091); `guard-differences` yêu cầu mọi id trong file có hàng trong spec:
  D-145..D-147 thêm vào `accepted-differences.ts` loại `doc`, `feature: '021'`, không `removeAt`.
- **Rationale**: `src/accepted-differences.test.ts` (job `guard-differences`) đối chiếu id và ô cuối của hàng
  (`src/spec-differences.ts`: ô đầu khớp `^D-\d+$`, ô cuối là "Gỡ khi/Gỡ ở"). Bảng của 021 theo mẫu 020 (cột cuối
  `Gỡ ở`, `—`); các dòng tham chiếu D-19, D-121, D-123, D-141, D-05, D-06, D-38 nằm ở bảng riêng với ô đầu `D-19 (001)`
  nên parser bỏ qua (checklist CHK022, CHK023).

## R12. CI

- **Decision**: `parity`: profile `bootstrap` cho postgres shard 1/2, 2/2 và sqlite3; `deploy`: lượt thứ ba
  `DEPLOY_MODE=standalone`; `deploy-k8s`: thêm phần standalone trong `kind-test.sh` (cùng job, cùng cụm; ước thêm
  5–8 phút, trần 40 phút); `docker`: thêm `docker run --rm <image> node cli.js --version` và `node cli.js security
  key:generate` (chứng minh CLI có trong image). `quality`: `check-port-headers` với manifest mới, `generate-migration-list`
  không đổi.
- **Rủi ro**: thời gian `deploy-k8s` (hiện ~25 phút [Unverified, từ run gần nhất]); nếu vượt, tách job `deploy-k8s-standalone`.

## R13. Ba lượt lên `main`

1. **Lượt 1 (API + image + parity bootstrap)**: R3, R4, R5, R6 phần `bootstrap`/`database`/`start`, `cli.js`, Dockerfile
   CMD, profile `bootstrap` với `schema.test.ts`, `cross.test.ts`, `partial.test.ts`, `image-swap` sửa; D-145, D-147
   một phần; FR-016 (bí mật trong log) cho `bootstrap`.
2. **Lượt 2 (CLI còn lại)**: `users`, `roles`, `cache`, `count`, `schema`, `security`, `init`, `load-extensions`;
   `cli.test.ts`, `init.test.ts`; D-146, D-147 đủ; README "Lệnh CLI".
3. **Lượt 3 (deploy)**: compose standalone, Helm mode/Job/ConfigMap, kind, deploy standalone, README "Chạy độc lập",
   sửa spec cũ và `accepted-differences.ts`.

Mỗi lượt CI xanh rồi mới lượt sau (quy ước 004, 020).

## R14. Điều chưa kiểm được trong lượt khảo sát

- Bố cục `/directus` trong image (`package.json`, `dist/`, `node_modules/`) suy từ `pnpm deploy` + `files: ["dist"]` và
  `clear-system-cache.ts` import `/directus/dist/cache.js`; T-task đầu tiên của lượt 1 chạy `docker run ... ls /directus`
  để chốt đường dẫn `cli.js`.
- `docker compose up --wait` với service một lần (R9).
- Thời gian job `deploy-k8s` sau khi thêm phần standalone (R12).
- `20240204A-marketplace` với `resolvePackage` ở vị trí mới (R4); `dropForeign` trên SQLite trong `20201028A` (Directus
  bootstrap SQLite chạy qua được, nên bản port cũng phải qua; kiểm ở profile `bootstrap` sqlite3).

## R15. Kết quả checklist `pre-tasks.md` (2026-10-22)

Chủ dự án chọn bốn mục (CHK003, CHK020, CHK033, CHK034, spec Clarifications); tác giả giải các mục còn lại. Thay đổi so
với R1–R14:

- **Owner report trong parity (CHK021)**: profile `bootstrap` đặt `COMPLIANCE_URL=http://registry:9100` và
  `depends_on: registry` như cặp chính; registry giả có `/v1/owner` (đếm report, trả 2xx) nên report của Directus thành
  công và `project_status` vẫn `null` ở cả hai DB. `schema.test.ts` đọc số đếm trước và sau: Directus +2 (migration
  `20251014A` và `bootstrap`), Backoffice +0 và 2 dòng log `owner report is out of scope` (D-38).
- **Dump (CHK005, CHK029)**: `dump.ts` lấy mọi bảng `directus_*` (không loại bảng nào) sau khi cả hai app healthy; cột
  từ `inspector.columnInfo()` (`name`, `data_type`, `is_nullable`, `default_value`, `max_length`, `numeric_precision`,
  `numeric_scale`), PK từ `primary()`, FK từ `foreignKeys()` (gồm `on_delete`), index từ `indexesOf()` của
  `db-snapshot.ts`; hàng `select *` sắp theo PK. SQLite: inspector trả kiểu khai báo và default dạng chuỗi, so như vậy.
- **Chuẩn hóa (CHK012, CHK013)**: `tests/parity/src/bootstrap/normalize.ts` cài đúng danh sách spec FR-107 (dùng
  `comparable()` của `src/system/helpers.ts` cho cột thời gian, argon2, token); log so cặp (`level`, `msg`) của pino raw.
- **Bí mật (CHK006)**: `cli.test.ts` và `schema.test.ts` tìm giá trị `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `DB_PASSWORD`,
  `SECRET` của env profile trong mọi log thu được; không được có (spec FR-016). Thêm một lần `bootstrap` với
  `DB_PASSWORD` sai để kiểm log lỗi kết nối.
- **DB cài dở (CHK003, giống Directus)**: `partial.test.ts` (profile `bootstrap`, Postgres): tạo hai DB trống, chạy
  `database install` bằng image Directus trên cả hai rồi `DROP TABLE directus_fields` (bảng đầu tiên migration
  `20201028A` sửa qua `dropForeign`), chạy `bootstrap` bằng image Directus trên DB một và image
  Backoffice trên DB hai → cùng mã thoát (1), cùng dòng log lỗi sau chuẩn hóa FR-107, cùng `directus_migrations` sau
  lần chạy (spec FR-015).
- **Cache (CHK030, SC-004)**: `cross.test.ts` tạo collection `bo_bootstrap_cache` qua API trước khi migrate, `GET
  /items/bo_bootstrap_cache` hai lần mỗi app (lần hai HIT), chạy bước migrate, lần đầu sau đó MISS ở cả hai app; profile
  bật `CACHE_ENABLED=true`, `CACHE_STORE=redis`, `CACHE_STATUS_HEADER=x-cache-status` như `env/postgres.env`.
- **`init` qua stdin (CHK040)**: lượt 2 thử `compose exec -T` với stdin; nếu `inquirer` 12 không đọc stdin không TTY,
  chạy `script -qec "node cli.js init" /dev/null` trong container (`util-linux` `script` có trong Alpine? [Unverified]:
  nếu không có, thêm test `init` ở unit với `inquirer.prompt` giả và giữ parity cho phần không hỏi đáp).
- **Helm (CHK008, CHK016, CHK018, CHK035, CHK009, CHK034)**: Job `parallelism: 1`, `completions: 1`, cùng
  `securityContext` pod và container như `api-deployment.yaml` (dùng chung `backoffice.securityContext` của
  `_helpers.tpl`), `resources: {{ .Values.bootstrap.resources | default .Values.api.resources }}`; `_checks.tpl` thêm
  kiểm `MIGRATIONS_PATH` khi `migrations.configMap` đặt (spec FR-085); NOTES: (a) standalone + `migrations.configMap` →
  dòng "After changing the migrations ConfigMap, run helm upgrade right away"; (b) shared → dòng "The database must be
  bootstrapped by Directus before Backoffice pods start" (019 FR-024). README: Helm `install` lỗi → `helm uninstall` rồi
  `install` (spec US6 kịch bản 3).
- **Compose (CHK036, CHK039)**: `standalone.test.ts` kiểm thêm: hệ thống đang chạy, thêm migration `fail/` vào volume,
  `up -d --wait` lỗi, replica cũ vẫn `running` và cùng `StartedAt` [Unverified hành vi compose: kiểm ở lượt 3]. README ghi
  Docker Compose ≥ 2.24.
- **Coverage (CHK027)**: `apps/api/vitest.config.ts` thêm `src/database/migrations/2*.ts` vào `coverage.exclude` với
  comment lý do (spec FR-106).
- **Spec cũ (CHK042)**: danh sách dòng ở spec FR-091, làm ở lượt 3.
- **`20240204A-marketplace` (CHK041)**: chỉ có tác dụng khi `directus_extensions` có hàng từ trước bản Directus thêm
  migration này; DB trống (bootstrap) và DB 11.17.4 (đã chạy) không chạy lại nó, nên đường dẫn `__dirname` mới chỉ ảnh
  hưởng DB Directus cũ hơn có extension được Backoffice nâng lên (Edge Cases, CHK033); khi đó kết quả phân loại
  `module`/`local` phải giống image Directus, kiểm bằng tay ở lượt 1 nếu có DB mẫu cũ, nếu không ghi [Unverified].

## Kết quả T001 (2026-10-22)

- (a) Image `hiennd23/backoffice-api:local` hiện có: `/directus/{package.json, dist/, node_modules/, database/, extensions/,
  uploads/}`; `dist/` là cây của `apps/api/dist` (`main.js`, `cache.js`, ...). `cli.js` ở gốc package sẽ vào
  `/directus/cli.js` khi thêm vào `files` (R1 đúng).
- (b) Image không có lệnh `script` (util-linux): test `init` không dùng được pseudo-TTY bằng `script` trong container;
  T058 thử stdin không TTY, nếu không được thì dùng phương án dự phòng (unit test với `inquirer.prompt` giả).
- (c) Docker Compose local v5.5.0. Runner CI `ubuntu-24.04` (image 20261018.339.1); phiên bản Compose của runner chưa
  in trong log, [Unverified] ≥ 2.24; T065 chạy `docker compose ... config` trong CI để chứng minh `!reset` đọc được.
- (d) `directus/directus:11.17.4` không env (SQLite): từ khi container chạy tới `Server started` 12 s, trong đó từ
  `Initializing bootstrap...` tới `Server started` khoảng 6 s; 101 dòng `Applying`. Postgres đo ở profile `bootstrap`
  (SC-010).
- (e) Run 39660476604: `deploy-k8s` 4 phút 37 giây, `deploy` 6 phút 45 giây; còn nhiều chỗ dưới trần 40 phút.

## Kết quả lượt 1 (2026-10-22)

- Image `hiennd23/backoffice-api:local` (build local, linux/amd64): không env (SQLite) → seed, 101 `Applying`, admin,
  `Done`, rồi `Server started`; `/server/ping` 200 sau 7 s từ `docker run` (SC-007 < 60 s). PID 1 là `/sbin/tini`,
  `node cli.js start` là con của tini (ppid 1), uid 1000 (FR-060, FR-062).
- T026: `DB_PASSWORD=t026-secret-value-77`, DB không tới được → mã 1 sau 5 lần chờ, 0 dòng log chứa giá trị (FR-016).
- Lỗi tìm thấy khi chạy `start` trên image: CLI nạp extension trước server, `extensions/services.ts` import
  `server.service` → `server.js` → module Nest → `server.controller` (`@Inject(ServerService)`) trong vòng import →
  `ReferenceError: Cannot access 'ServerService' before initialization`. Sửa: `extraServices()` import `../server.js`
  trước (file riêng của Backoffice, không phải bản port).
- Parity profile `bootstrap` trên Postgres (local, chỉ các service của profile, `--no-deps`): `schema.test.ts` 6/6
  (bảng, cột, FK, index, hàng sau FR-107, 101 migration cùng thứ tự, Directus gửi 2 owner report, Backoffice 0 và log
  D-38 hai lần, log không chứa bí mật), `cross.test.ts` 8/8, `partial.test.ts` 1/1. Thời gian bootstrap (SC-010):
  Directus 1215 ms, Backoffice 1177 ms.
- Khác biệt mới: fixture `noup` → Directus log `up$1 is not a function` (bundler của image đổi tên biến), Backoffice
  `up is not a function`; cùng cảnh báo, cùng mã 1. Thêm quy tắc chuẩn hóa vào FR-107 (chờ chủ dự án duyệt).
- SQLite và MySQL (`vendor.test.ts`) không chạy local: cặp chính SQLite/MySQL cần cổng của cặp Postgres đang chạy cho
  phiên khác; để CI (parity sqlite3 có `bootstrap`, mysql chạy `vendor.test.ts` trong bộ reduced).
- Registry: dùng service riêng `registry-bootstrap` (cổng 6115, cùng `server.mjs`) thay cho đếm theo `project_owner`
  trong `server.mjs` (contracts/tests.md, T033 a): số report của profile tách hẳn, không phải khởi động lại registry
  chung. Trên máy có `DOCKER_DEFAULT_PLATFORM=linux/amd64`, `postgres-bootstrap` và `registry-bootstrap` phải bật với
  platform gốc (`node:22-alpine` local chỉ có arm64).

