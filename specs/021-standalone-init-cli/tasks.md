---

description: "Danh sách task cho feature 021: chạy độc lập (bootstrap, migration, CLI giống Directus 11.17.4, compose và Helm độc lập)"
---

# Tasks: Chạy độc lập (khởi tạo DB, migration và CLI giống Directus 11.17.4)

**Input**: Tài liệu thiết kế trong `/specs/021-standalone-init-cli/`
**Prerequisites**: `plan.md`, `spec.md` (đã duyệt 2026-10-22). Dùng thêm `research.md` (R1–R15), `data-model.md`,
`contracts/` (`cli.md`, `migrations.md`, `deploy.md`, `tests.md`), `quickstart.md`, `checklists/pre-tasks.md`.

**Điều kiện bắt đầu**: constitution 3.0.0 và spec/plan 021 đã ở `main` (commit `87304042`). Làm trên `main`; checkout
dùng chung với các phiên khác: `git add` theo đường dẫn, không `git add -A`/`.`, không `stash`, `reset`, `checkout --`;
trước và sau mỗi lần push nhắn các phiên đang chạy chung checkout (2026-10-22: "Spec cho app extension support"), chờ
run CI đang chạy xong (push mới hủy run cũ). Không sửa file dưới `directus/`. Máy local: chạy test từng file, `nice`,
`--maxWorkers=1`; không `nx run-many` toàn bộ; không dừng các container và dev server của phiên khác (parity-postgres
8155/6100/6108/8881, API 8166, web 4221/4222); profile `bootstrap` dùng cổng riêng (6114, 10755–10757).

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Feature không thêm hay sửa endpoint REST/GraphQL. Đối chiếu ở mức CLI và DB: profile parity `bootstrap` so schema, hàng
  hệ thống, `directus_migrations`, mã thoát, stdout và log của từng lệnh giữa image Directus 11.17.4 và image Backoffice
  (spec FR-100..FR-102, FR-107).
- Mỗi file mới có unit test; test viết trước và chạy đỏ rồi mới viết code (trừ file chép nguyên văn: test so nguyên văn
  viết trước, chạy đỏ vì chưa có file).
- File chép nguyên văn từ Directus (101 migration, 15 seed, `run.ts`) có test máy kiểm "nguyên văn" (spec FR-025, FR-012).

**Organization**: Task nhóm theo user story, xếp theo ba lượt commit (research R13): **Lượt 1** = Phase 1, 2, 3 (US1),
4 (US7), 5 (US2), 6 (US4); **Lượt 2** = Phase 7 (US3), 8 (US8); **Lượt 3** = Phase 9 (US5), 10 (US6), 11 (Polish). Mỗi
lượt kết thúc bằng task "đóng lượt" (lint, typecheck, test liên quan xanh, commit, nhắn phiên khác, push, CI xanh,
`graphify update .`). US7 nằm ở lượt 1 vì CMD mới chạy `bootstrap` trên mọi cặp parity, kể cả MySQL (FR-063).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Viết tắt đường dẫn: `api/` = `apps/api/`; `parity/` = `tests/parity/`; `compose/` = `deploy/compose/`; `chart/` =
  `deploy/helm/backoffice/`; đường dẫn Directus tính từ `directus/api/src/` trừ khi ghi khác.
- File port: dòng 1 `// Ported from directus/<đường dẫn>` (yaml: `# Ported from directus/<đường dẫn>`), và một manifest
  `tools/port-manifest/021-T###.json` (`[{ "source": "<đường dẫn dưới directus/>", "dest": "<đường dẫn repo>" }]`) cho
  task tạo file đó; `pnpm run check-port-headers` phải đạt.
- Không thêm biến env mới (VIII). `PROJECT_OWNER`, `ACCEPT_TERMS` là biến Directus chuyển sang "hỗ trợ" (FR-010).
- Không lock cho `bootstrap`, không transaction bao seed hay migration, không kiểm DB cài dở (FR-007, FR-015: giống
  Directus).
- Thông điệp của D-145 và D-147 lấy đúng câu chữ ở spec FR-008, FR-026, FR-057 và contracts/cli.md.
- Test parity in số liệu đo (thời gian `bootstrap`, số request, lỗi) ra log để đối chiếu SC-001..SC-010.

## Phase 1: Setup (kiểm giả định, dependency, biến env)

**Purpose**: chốt các điểm "[Unverified]" của research R14/R15 trước khi viết code, thêm dependency.

- [X] T001 Kiểm và ghi "Kết quả T001" vào `specs/021-standalone-init-cli/research.md`: (a) `pnpm nx run api:container`
      rồi `docker run --rm --entrypoint sh hiennd23/backoffice-api:local -c 'ls -la /directus /directus/dist | head -40'`:
      chốt bố cục `/directus` (`package.json`, `dist/main.js`, `node_modules/`) và nơi đặt `cli.js` (R14); (b)
      `docker run --rm --entrypoint sh hiennd23/backoffice-api:local -c 'command -v script || echo none'` (pseudo-TTY
      cho test `init`, R15); (c) `docker compose version` ở máy local và ghi bản Compose trên runner `ubuntu-latest`
      (CI log của job `deploy` gần nhất) ≥ 2.24 cho `!reset` (R9); (d) đo thời gian `bootstrap` của image
      `directus/directus:11.17.4` trên một Postgres trống (container tạm, cổng ngẫu nhiên, xóa sau khi đo) và trên
      SQLite (không env): mốc cho SC-010; (e) thời gian job `deploy-k8s` của run CI gần nhất (`gh run view`) để ước
      thêm phần standalone (R12).
- [X] T002 [P] Thêm vào catalog `pnpm-workspace.yaml` (bản của `directus/pnpm-workspace.yaml`, kiểm lại lúc làm):
      `commander` 14.0.2, `inquirer` 12.11.0, `chalk` 5.6.2, `liquidjs` 10.25.7; thêm `commander`, `inquirer`, `chalk`,
      `liquidjs`, `uuid` (`catalog:`, 11.1.0 đã có) vào `dependencies` của `api/package.json`; `pnpm install`; chạy
      `pnpm audit --prod` và đối chiếu `auditConfig` (không có advisory high/critical mới; nếu có thì dừng và hỏi chủ dự
      án). Không thêm `ora`, `execa`, `copyfiles`, `@types/inquirer` (research R6).
- [X] T003 [P] Sửa `api/src/config/supported-variables.ts`: thêm `PROJECT_OWNER` và `ACCEPT_TERMS` vào
      `SUPPORTED_VARIABLES` (nhóm comment "Feature 021"), xóa `PROJECT_OWNER` khỏi `NOT_APPLICABLE_VARIABLES` (danh sách
      thành rỗng, giữ export); test trong `api/src/config/supported-variables.test.ts` và
      `api/src/config/warn-unsupported-variables.test.ts` (không còn cảnh báo cho hai biến) (FR-010).

---

## Phase 2: Foundational (seed, 101 migration, `run.ts`, phần thiếu)

**Purpose**: bộ seed và migration chép nguyên văn cùng bộ chạy migration; mọi user story cần chúng.

**⚠️ CRITICAL**: chưa xong phase này thì không làm phase 3 trở đi.

- [X] T004 [P] Port `directus/packages/utils/shared/process-chunk.ts` sang `libs/utils/src/shared/process-chunk.ts`,
      re-export ở `libs/utils/src/shared/index.ts`; test `libs/utils/src/shared/process-chunk.test.ts` (port test
      Directus nếu có, nếu không thì viết test chia mảng thành các khúc và gọi callback theo thứ tự); manifest
      `tools/port-manifest/021-T004.json` (research R4).
- [X] T005 [P] Port `SettingsModuleBarLink`, `SettingsModuleBarModule` từ `directus/packages/types/src/settings.ts:3-18`
      vào `libs/types/src/settings.ts` (re-export qua `libs/types/src/index.ts` nếu `settings.ts` chưa được export); build
      `libs/types` và `libs/utils` (`pnpm --filter @backoffice/types --filter @backoffice/utils build`).
- [X] T006 [P] Thêm `api/src/types/migration.ts` (port `types/migration.ts`: `{ version: string; name: string;
      timestamp: Date }`), export ở `api/src/types/index.ts`; manifest `tools/port-manifest/021-T006.json`.
- [X] T007 Viết test `api/src/database/migrations/port.test.ts` (chạy đỏ trước T008): với mỗi file
      `directus/api/src/database/migrations/<file>` khớp `^[0-9]+[A-Z]-[^.]+\.ts$`, đọc bản port cùng tên, bỏ dòng 1 (phải
      là `// Ported from directus/api/src/database/migrations/<file>`), áp bảng thay thế specifier của spec FR-025 lên bản
      gốc, so bằng nhau từng ký tự; tập version của thư mục port (101, `20201028A` … `20260211A`) bằng
      `DIRECTUS_MIGRATIONS` của `directus-11.17.4.ts`; thư mục port không có file migration thừa. (FR-025, FR-105)
- [X] T008 Chép 101 migration vào `api/src/database/migrations/` bằng một script tạm trong scratchpad (không commit):
      thêm dòng 1 header, thay 9 specifier theo bảng FR-025 (`@directus/{utils,utils/node,schema,env,constants,types}` →
      `@backoffice/...`; `../../utils/get-schema.js` → `../../schema/get-database-schema.js`; `../../services/fields.js`
      → `../../services/fields.service.js`; `../../services/settings.js` → `../../services/settings.service.js`);
      manifest `tools/port-manifest/021-T008.json` (101 mục); `pnpm --filter @backoffice/api typecheck` đạt (nếu một
      import thiếu export, port thêm vào lib theo Nguyên tắc I, không sửa migration); T007 xanh.
- [X] T009 [P] Port test `migrations/run.test.ts` sang `api/src/database/migrations/run.test.ts` (8 test,
      `knex-mock-client`; header; đổi import theo FR-025; manifest `tools/port-manifest/021-T009.json`) (chạy đỏ trước
      T010). (FR-020..FR-024, FR-105)
- [X] T010 Port `migrations/run.ts` sang `api/src/database/migrations/run.ts` (đổi `@directus/env` → `@backoffice/env`,
      `@directus/format-title` → `@backoffice/format-title`; `flushCaches` từ `../../cache.js`, `getModuleDefault` từ
      `../../utils/get-module-default.js`, `Migration` từ `../../types/index.js`); manifest
      `tools/port-manifest/021-T010.json` (run.ts); T009 xanh (contracts/migrations.md). (FR-022, FR-023)
- [X] T011 [P] Chép 15 file `database/seeds/*.yaml` sang `api/src/database/seeds/` với dòng 1 `# Ported from
      directus/api/src/database/seeds/<file>`; viết test `api/src/database/seeds/run.test.ts` (chạy đỏ trước T012): (a)
      mỗi yaml bằng bản Directus sau khi bỏ dòng 1; (b) SQLite in-memory: `runSeed` tạo đúng 15 bảng với cột như yaml
      (kiểm bằng `createInspector(...).columnInfo`); (c) DB đã có `directus_collections` → `Database is already
      installed` (FR-011..FR-013); manifest `tools/port-manifest/021-T011.json` (15 yaml; Directus không có
      test cho seed nên `run.test.ts` là file mới). (FR-105)
- [X] T012 Port `database/seeds/run.ts` sang `api/src/database/seeds/run.ts` (`getHelpers` của `../helpers/index.js`);
      manifest `tools/port-manifest/021-T012.json` (seeds/run.ts); T011 xanh.
- [X] T013 Sửa script `build` của `api/package.json`: sau `swc ...` thêm bước copy `.yaml` và `.liquid` từ `src` sang
      `dist` giữ cây thư mục (`node -e` với `fs.cpSync` và `filter` như `libs/system-data`, research R3); kiểm
      `pnpm --filter @backoffice/api build` rồi `ls api/dist/database/seeds/*.yaml | wc -l` = 15. (FR-061)
- [X] T014 [P] Thêm `migrationsValid(database?: Knex): Promise<boolean>` vào `api/src/database/validate-migrations.ts`
      (`checkMigrations` rồi `missing.length === 0`, như `validateMigrations` boolean của Directus, không `process.exit`);
      test trong `api/src/database/validate-migrations.test.ts` (R5).
- [X] T015 [P] Thêm `'src/database/migrations/2*.ts'` vào `coverageExclude` của `api/vitest.config.ts` với comment lý do
      (bản chép máy kiểm ở `port.test.ts`, chạy thật ở profile parity `bootstrap`; spec FR-106).

**Checkpoint**: `port.test.ts`, `run.test.ts`, `seeds/run.test.ts` xanh; build có seed trong `dist`.

---

## Phase 3: User Story 1 - Một container trên DB trống tự khởi tạo và chạy như image Directus (Priority: P1) 🎯 MVP

**Goal**: image API chạy `bootstrap` rồi `start`; DB trống (Postgres, SQLite) được tạo giống Directus 11.17.4.

**Independent Test**: profile parity `bootstrap`: hai DB trống, Directus và Backoffice mỗi bên tự bootstrap; dump schema,
hàng hệ thống, `directus_migrations` bằng nhau sau chuẩn hóa; `docker run` không env trả `/server/ping` dưới 60 s.

### Tests cho User Story 1

- [X] T016 [P] [US1] Unit test `api/src/cli/commands/bootstrap/index.test.ts` (chạy đỏ trước T021): chờ DB 5 lần × 5 s
      với fake timers (`hasDatabaseConnection` giả), hết lượt thì `validateDatabaseConnection`; DB trống: thứ tự `runSeed`,
      `run('latest')`, `createAdmin`, `upsertSingleton({ project_name })`, `setOwner` khi `PROJECT_OWNER` là email (không
      khi không phải email); `--skipAdminInit`; DB đã cài: chỉ `run('latest')`; dòng log (`level`, `msg`) đúng contracts/cli.md
      (D-147); `database.destroy()` và mã 0. (FR-002..FR-006, FR-009, FR-010)
- [X] T017 [P] [US1] Unit test `api/src/cli/commands/database/install.test.ts` và `migrate.test.ts`: mã thoát, log
      `Running migrations...`, `Database up to date`, `Downgrade successful`, lỗi → mã 1 (FR-058, FR-059).
- [X] T018 [P] [US1] Unit test `api/src/cli/index.test.ts` cho cây lệnh lượt 1 (`start`, `bootstrap [--skipAdminInit]`,
      `database install|migrate:latest|migrate:up|migrate:down`), `program.name('backoffice')`, `--version` =
      `BACKOFFICE_VERSION`, `allowExcessArguments`; `loadExtensions` gọi trước khi khai báo lệnh (mock) (FR-040, FR-044).

### Implementation cho User Story 1

- [X] T019 [P] [US1] Port `cli/run.ts` sang `api/src/cli/run.ts` (`console.error` với `eslint-disable-next-line
      no-console` như Directus, mã 1) và `cli/load-extensions.ts` sang `api/src/cli/load-extensions.ts` (dùng
      `migrationsValid` của T014; `getExtensionManager().initialize({ schedule: false, watch: false })`); manifest
      `tools/port-manifest/021-T019.json`.
- [X] T020 [US1] Port `cli/index.ts` sang `api/src/cli/index.ts` (commander 14): lượt 1 khai báo `start`, `bootstrap`,
      `database install`, `database migrate:latest|up|down` với mô tả và option như Directus; `program.name('backoffice')`,
      `program.version(BACKOFFICE_VERSION)` (D-147); `emitter.emitInit('cli.before', { program })` và `cli.after` như
      Directus (FR-043); T018 xanh. Các lệnh còn lại thêm ở lượt 2 (T055).
- [X] T021 [US1] Port `cli/commands/bootstrap/index.ts` sang `api/src/cli/commands/bootstrap/index.ts` (`waitForDatabase`,
      `isInstalled`, `runSeed` T012, `runMigrations` T010, `getSchema` của `../../../schema/get-database-schema.js`,
      `createAdmin` của 010, `SettingsService` `upsertSingleton`/`setOwner` (D-38), `email()` của zod); log `Installing
      Directus system tables...` giữ nguyên (D-147); T016 xanh (phần không thuộc US7). (FR-002..FR-006, FR-009)
- [X] T022 [P] [US1] Port `cli/commands/database/install.ts` và `migrate.ts` sang `api/src/cli/commands/database/`;
      T017 xanh.
- [X] T023 [P] [US1] Viết `api/src/cli/commands/start.ts`: `logUnhandledRejections()`, `await runStartupChecks()`, `await
      import('../../server.js')`, `startServer()` (giống `api/src/main.ts`, research R2); test `start.test.ts` (mock thứ tự
      gọi). `api/src/main.ts` giữ nguyên.
- [X] T024 [US1] Thêm `api/cli.js` (`#!/usr/bin/env node` + `import('./dist/cli/run.js');`), `api/package.json`:
      `"files": ["dist", "cli.js"]`, `"bin": { "backoffice": "cli.js" }`; kiểm `node apps/api/cli.js --version` và
      `node apps/api/cli.js --help` sau build (FR-040).
- [X] T025 [US1] Sửa `api/Dockerfile`: builder `mkdir -p dist/database dist/extensions dist/uploads dist/migrations`;
      runtime `CMD ["/bin/sh", "-c", "node cli.js bootstrap && exec node cli.js start"]`, `ENTRYPOINT` tini giữ; build
      lại `pnpm nx run api:container`; kiểm `docker run --rm hiennd23/backoffice-api:local` không env: log bootstrap SQLite
      rồi `Server started`, `/server/ping` trong dưới 60 s (SC-007), `docker exec ... ps` cho PID 1 là tini và node là con
      của tini (FR-001, FR-060, FR-062).
- [X] T026 [US1] Kiểm FR-016 ở mức code: `api/src/cli/run.ts` và lỗi kết nối DB không log cấu hình knex (thử
      `DB_PASSWORD=sai` trên image local, `grep` giá trị trong log = 0 dòng); ghi kết quả vào research "Kết quả T001".

### Parity cho User Story 1

- [X] T027 [US1] Profile `bootstrap` trong `parity/docker-compose.yml`: `postgres-bootstrap` (`postgis/postgis:13-3.4-alpine`,
      cổng `6114:5432`, init SQL `parity/env/bootstrap-init.sql` tạo DB `directus_bootstrap`, `backoffice_bootstrap`,
      `directus_partial`, `backoffice_partial`), `directus-bootstrap` (10755), `backoffice-api-bootstrap` (10756, CMD mặc
      định, `build` như `backoffice-api-setup`), `directus-on-backoffice-db` (10757, `depends_on`
      `backoffice-api-bootstrap` healthy); env chung `parity/env/profile-bootstrap-postgres.env`,
      `profile-bootstrap-sqlite3.env` theo contracts/tests.md (`COMPLIANCE_URL=http://registry:9100`,
      `PROJECT_OWNER=owner-bootstrap@example.com`, `LOG_STYLE=raw`, `CACHE_*`); khối `environment:` riêng từng service:
      `DB_DATABASE`/`DB_FILENAME`, `PUBLIC_URL`, `REDIS` (db 10 cho `directus-bootstrap`, db 11 cho hai app trên
      `backoffice_bootstrap`), `CACHE_NAMESPACE`/`REDIS_BUS_NAMESPACE`/`REDIS_LOCK_NAMESPACE` (`parity-bootstrap-d`,
      `parity-bootstrap-b`), `MIGRATIONS_PATH: ${BOOTSTRAP_MIGRATIONS_DIR:-/directus/migrations}`; bind
      `./fixtures/migrations:/directus/migrations:ro`, sqlite `./.data/bootstrap`; mọi app `depends_on: registry`.
- [X] T028 [US1] Đăng ký profile: `parity/scripts/env.mjs` (`ALL_PROFILES`, tạo `.data/bootstrap` 0777 như sqlite),
      `parity/src/docker.ts` (danh sách profile của `compose()`), `parity/src/config.ts` (`profilePorts.bootstrap = {
      directus: 10755, backoffice: 10756 }`, `bootstrapDbPort = 6114`, `bootstrapCrossPort = 10757`); kiểm `node
      scripts/env.mjs up --vendor=postgres --profiles=bootstrap` dựng được và `global-setup` đặt `DIRECTUS_URL_BOOTSTRAP`.
- [X] T029 [P] [US1] Fixture `parity/fixtures/migrations/{ok,collide,nodash,noup,fail}/` theo contracts/tests.md
      (`ok/20990101A-create-sample.js`, `20990102A-add-column-default.js`, `20990103A-in-transaction.js`;
      `collide/20201028A-collide.js`; `nodash/utils.js`, `nodash/20990104A-ts-ignored.ts`; `noup/20990105A-no-up.js`;
      `fail/20990106A-throws.js`), ESM `export async function up(knex)`/`down(knex)`.
- [X] T030 [P] [US1] `parity/src/bootstrap/normalize.ts` cài đúng danh sách FR-107 (dùng `comparable()` của
      `parity/src/system/helpers.ts`); unit test `parity/src/bootstrap/normalize.test.ts` (thêm vào `include` của
      `parity/vitest.config.ts`).
- [X] T031 [P] [US1] `parity/src/bootstrap/dump.ts` (`dump(db)`: mọi bảng `directus_*`, cột từ `createInspector().columnInfo`,
      PK, FK gồm `on_delete`, index qua `indexesOf` của `db-snapshot.ts`, hàng sắp theo PK; FR-100); unit test trên SQLite
      in-memory `parity/src/bootstrap/dump.test.ts`.
- [X] T032 [P] [US1] `parity/src/bootstrap/cli.ts`: `cli(service, args, env?, stdin?) → { code, stdout, stderr }` qua
      `docker compose -p parity-<vendor> exec -T [-e K=V]... <service> node cli.js ...` (bắt `status`); `logs(service,
      since)` lọc pino raw → (`level`, `msg`).
- [X] T033 [US1] Baseline và `parity/src/bootstrap/schema.test.ts` (FR-100, FR-014, FR-010, FR-016, SC-001): (a)
      (làm bằng service riêng `registry-bootstrap`, xem research "Kết quả lượt 1") `parity/registry/server.mjs` đếm thêm report theo `project_owner` của body (`GET /v1/owner?project_owner=<email>` →
      `{ count }`; giữ `count`, `last` toàn cục cho 010); (b) `parity/src/bootstrap/baseline.ts` chụp một lần trong
      `parity/src/global-setup.ts` khi có `profileUrls('bootstrap')`, trước mọi test: `dump()` hai DB (Postgres:
      `directus_bootstrap`, `backoffice_bootstrap`; SQLite: hai file), log khởi động (`level`, `msg`) của
      `directus-bootstrap` và `backoffice-api-bootstrap`, số report của `owner-bootstrap@example.com`; ghi
      `parity/.data/bootstrap/baseline.json`; (c) `schema.test.ts` chỉ đọc baseline (không đọc DB đang chạy, vì
      `cross`/`cli`/`partial`/`init` ghi vào DB và thứ tự file không cố định): bỏ qua khi không có baseline; `diffJson`
      rỗng sau chuẩn hóa; `directus_migrations` 101 hàng cùng `version`, `name`, thứ tự; 2 report của email profile, log
      Backoffice có 2 dòng `owner report is out of scope`; log khởi động không chứa `ADMIN_PASSWORD`, `ADMIN_TOKEN`,
      `DB_PASSWORD`, `SECRET`, `KEY` của env; in thời gian `bootstrap` của hai app (SC-010). Thêm `src/bootstrap/**/*.test.ts`
      vào `FULL_FILES` và `REDUCED_FILES` của `parity/src/suite.ts`.
- [X] T034 [US1] Sửa `parity/src/deploy/image-swap.test.ts` (FR-063): "stops on a database Directus never bootstrapped"
      → "bootstraps an empty database" (container healthy, đăng nhập bằng `ADMIN_*`, `directus_migrations` = 101); thêm
      `node cli.js --version` in phiên bản Backoffice; giữ các bài tini/PID 1, uid 1000, SIGTERM 143.
- [X] T035 [US1] CI `.github/workflows/ci.yml`: job `parity` thêm `bootstrap` vào `profiles` của postgres (2 shard) và
      sqlite3; job `docker` thêm bước `docker run --rm --entrypoint node hiennd23/backoffice-api:ci cli.js --version` và
      `ls /directus/dist/database/seeds` (15 yaml) (research R12).

**Checkpoint**: US1 đạt độc lập: parity `bootstrap` Postgres và SQLite xanh ở local.

---

## Phase 4: User Story 7 - Vendor ngoài Postgres và SQLite (Priority: P2, lượt 1)

**Goal**: cổng D-145 cho `bootstrap`, `database install`, `database migrate:*`.

**Independent Test**: `TEST_DB=mysql`: `bootstrap` DB trống mã 1; DB do Directus bootstrap: container Backoffice khởi
động như trước, `bootstrap` không migrate.

- [X] T036 [P] [US7] Unit test `api/src/cli/utils/assert-vendor.test.ts` (chạy đỏ trước T037): `getDatabaseClient()` là
      `postgres`, `sqlite` → tiếp; `mysql`, `mssql`, `oracle`, `cockroachdb`, `redshift` → thông điệp đúng FR-008/FR-026
      theo chế độ (`bootstrap` DB trống mã 1, `bootstrap` DB đã cài mã 0 + `Done`, `install`/`migrate:*` mã 1). (FR-105)
- [X] T037 [US7] Viết `api/src/cli/utils/assert-vendor.ts` (`assertBootstrapVendor(mode)`; làm thành `unsupportedClient()` + `vendorMessages`, mỗi lệnh tự chọn mã thoát) và gọi ở
      `cli/commands/bootstrap/index.ts` (sau `waitForDatabase`), `database/install.ts`, `database/migrate.ts`; mở rộng
      T016 với các nhánh vendor; T036, T016 xanh (D-145, research R5).
- [X] T038 [US7] `parity/src/bootstrap/vendor.test.ts` (FR-008, FR-026, SC-008): chỉ khi `TEST_DB=mysql`, không khởi động
      lại cặp chính (các test khác đang dùng nó): log khởi động của `backoffice-api` (`docker compose logs`) có `Database on
      mysql is migrated by Directus 11.17.4 (D-145); skipping migrations` và không `Applying`; `cli('backoffice-api',
      ['database','migrate:latest'])` mã 1 với thông điệp D-145; `docker compose run --rm --no-deps backoffice-api node
      cli.js bootstrap` (container tạm, cùng DB) mã 0, không `Applying`; thêm file vào `REDUCED_FILES`.

**Checkpoint**: CMD mới an toàn trên mọi vendor của parity.

---

## Phase 5: User Story 2 - DB đã cài: mỗi lần khởi động chỉ chạy migration còn thiếu (Priority: P1)

**Goal**: `bootstrap` trên DB đã cài chỉ `migrate latest`; custom migration áp một lần, cache bị xóa.

**Independent Test**: DB đã bootstrap; thêm custom migration vào `MIGRATIONS_PATH`; khởi động lại container; so với
Directus làm cùng việc.

- [X] T039 [US2] Thêm vào `parity/src/bootstrap/cross.test.ts` khối "installed DB" (US2): (1) restart
      `backoffice-api-bootstrap` không migration mới → log `Database already initialized, skipping install`, `Running
      migrations...`, `Done`, số hàng mọi bảng không đổi; (2) đặt `process.env.BOOTSTRAP_MIGRATIONS_DIR=/directus/migrations/ok`
      rồi `compose('up', '-d', '--force-recreate', '--wait', 'directus-bootstrap', 'backoffice-api-bootstrap')` (compose
      nội suy `${BOOTSTRAP_MIGRATIONS_DIR}` của T027) → 3 hàng mới ở mỗi DB, `name` qua `formatTitle`, `directus_migrations`
      hai DB bằng nhau; xóa biến và tạo lại hai service sau khối; (3) chèn tay một version lạ vào `directus_migrations` của
      `backoffice_bootstrap` → `bootstrap` mã 0, `start` mã 1 liệt kê version thừa (001 D-05), rồi xóa hàng đó. (FR-036)
- [X] T040 [P] [US2] Unit test bổ sung `api/src/database/migrations/run.test.ts`: custom migration ở `MIGRATIONS_PATH`
      (thư mục tạm) được đọc, `.ts` và file không `-` bị bỏ, `.cjs`/`.mjs` được nhận; `flushCaches(true)` gọi một lần sau
      `latest` có áp (FR-020, FR-021, FR-027).

---

## Phase 6: User Story 4 - Migration chung với Directus, hai chiều (Priority: P1)

**Goal**: migrate chéo giữa hai app trên cùng `MIGRATIONS_PATH`; DB do Backoffice tạo dùng được với Directus.

**Independent Test**: `latest` ở Backoffice → Directus khởi động; `down` ở Directus → `up` ở Backoffice; so sau mỗi bước.

- [X] T041 [US4] Hoàn thiện `parity/src/bootstrap/cross.test.ts` (FR-035, FR-101, SC-002, SC-004): 10757
      (`directus-on-backoffice-db`) `/server/health` không `error`, log không có `Database migrations have not all been
      run`, đăng nhập admin, tạo collection + item; `cli('directus-on-backoffice-db', ['database','migrate:latest'])` →
      `Database up to date`, không `Applying`; với `MIGRATIONS_PATH=/directus/migrations/ok` (`cli()` truyền `-e`):
      `migrate:down` ở `directus-on-backoffice-db` rồi `migrate:up` ở `backoffice-api-bootstrap` và ngược lại trên cùng DB
      `backoffice_bootstrap`, so `directus_migrations` và schema sau mỗi bước; cache: collection `bo_bootstrap_cache`,
      `GET /items/bo_bootstrap_cache` hai lần ở 10756 và 10757 (cùng DB, cùng namespace `parity-bootstrap-b`; lần hai
      `HIT`), sau mỗi bước lần đầu `MISS` ở cả hai.
- [X] T042 [US4] Thêm vào `cross.test.ts` các ca lỗi US4 (FR-020, FR-024): `MIGRATIONS_PATH=.../collide` → cả hai app
      `Migration keys collide! ...` mã 1, không hàng mới; `nodash` → file bị bỏ qua ở cả hai; `noup` → cảnh báo
      `Couldn't find the "up" function from migration <file>` rồi mã 1 ở cả hai; so mã thoát và log sau chuẩn hóa.
- [X] T043 [US4] `parity/src/bootstrap/partial.test.ts` (FR-015): `database install` bằng image Directus trên
      `directus_partial` và `backoffice_partial`, `DROP TABLE directus_fields` ở cả hai; `bootstrap` bằng Directus (DB
      một) và Backoffice (DB hai) qua `docker compose run --rm` với `DB_DATABASE` ghi đè → cùng mã thoát (1), cùng dòng
      log lỗi sau chuẩn hóa, cùng `directus_migrations`; dọn hai DB sau test.
- [X] T044 Đóng lượt 1: `pnpm --filter @backoffice/api lint typecheck`, unit test các file của Phase 1–6 (từng file,
      `--maxWorkers=1`), `pnpm run check-port-headers`, `pnpm nx run api:container`, parity profile `bootstrap` trên
      postgres và sqlite3 local, `TEST_DB=mysql` cho `vendor.test.ts` nếu máy đủ tài nguyên (không thì để CI); ghi kết quả
      đo vào research "Kết quả lượt 1"; commit theo đường dẫn (Conventional Commits, trailer); nhắn hai phiên khác, chờ CI
      đang chạy, push; theo dõi CI tới xanh (parity postgres/sqlite3/mysql, docker, deploy, deploy-k8s, quality);
      `graphify update .`.

---

## Phase 7: User Story 3 - Lệnh CLI giống Directus trong image Backoffice (Priority: P1, lượt 2)

**Goal**: đủ 16 lệnh của FR-040 với cùng mã thoát, stdout, log.

**Independent Test**: từng lệnh chạy ở hai image với cùng tham số trên hai DB giống nhau; so sau chuẩn hóa FR-107.

### Tests cho User Story 3

- [ ] T045 [P] [US3] Unit test `api/src/cli/commands/users/create.test.ts`, `passwd.test.ts` (FR-050, FR-051: thiếu tham
      số, email không phân biệt hoa thường, không có user mã 1, stdout `<id>\n`).
- [ ] T046 [P] [US3] Unit test `api/src/cli/commands/roles/create.test.ts` (FR-052: policy `Policy for <name>`, icon,
      `admin_access`/`app_access`, access, stdout).
- [ ] T047 [P] [US3] Unit test `api/src/cli/commands/cache/clear.test.ts` (FR-053: `CACHE_STORE=memory` thông báo mã 0;
      `--system`, `--data`, không cờ → chuỗi `Cleared ... successfully`).
- [ ] T048 [P] [US3] Unit test `api/src/cli/commands/count/index.test.ts` và `security/key.test.ts`, `secret.test.ts`
      (FR-054, FR-055).
- [ ] T049 [P] [US3] Unit test `api/src/cli/commands/schema/snapshot.test.ts`, `apply.test.ts` (FR-056, FR-057: yaml/JSON,
      hỏi ghi đè, `-y`, chưa cài → thông điệp D-147 mã 0, `No changes to apply.`, kế hoạch `--dry-run` giống chuỗi của
      `apply.ts`, `--ignoreRules`; `inquirer.prompt` giả).
- [ ] T050 [P] [US3] Unit test `api/src/utils/apply-snapshot.test.ts` (port test Directus nếu có).

### Implementation cho User Story 3

- [ ] T051 [P] [US3] Port `cli/commands/users/create.ts`, `users/passwd.ts`, `roles/create.ts` sang
      `api/src/cli/commands/` (service từ `../../../services/*.service.js`, `generateHash` của 003); manifest
      `tools/port-manifest/021-T051.json`; T045, T046 xanh.
- [ ] T052 [P] [US3] Port `cli/commands/cache/clear.ts`, `count/index.ts`, `security/key.ts`, `security/secret.ts`;
      manifest `021-T052.json`; T047, T048 xanh.
- [ ] T053 [P] [US3] Port `utils/apply-snapshot.ts` sang `api/src/utils/apply-snapshot.ts` (`getSchema`, `getSnapshot`,
      `getSnapshotDiff`, `applyDiff`, `flushCaches` đã có ở 006); manifest `021-T053.json`; T050 xanh.
- [ ] T054 [US3] Port `cli/commands/schema/snapshot.ts`, `schema/apply.ts` (`chalk`, `inquirer`, `js-yaml`,
      `isNestedMetaUpdate` của `../../../utils/apply-diff.js`; thông điệp chưa cài theo D-147); manifest `021-T054.json`;
      T049 xanh.
- [ ] T055 [US3] Hoàn thiện `api/src/cli/index.ts` đủ cây lệnh FR-040 (users, roles, cache, count, schema, security,
      init — `init` nối ở T061) với mô tả, option, mặc định như Directus; cập nhật `api/src/cli/index.test.ts`: snapshot
      `--help` của chương trình và từng lệnh, lỗi commander khi lệnh/option không tồn tại, `cli.before`/`cli.after` phát
      với `{ program }` (FR-040, FR-043, FR-044).

### Parity cho User Story 3

- [ ] T056 [US3] `parity/src/bootstrap/cli.test.ts` (FR-102, FR-050..FR-059, FR-016, SC-003): mỗi lệnh chạy ở
      `directus-bootstrap` và `backoffice-api-bootstrap` với cùng tham số (đưa hai DB về cùng trạng thái trước mỗi khối);
      so `{ code, stdout, logs }` sau chuẩn hóa; `--help` chương trình và từng lệnh, lệnh/option lạ; tác động DB (`users`,
      `roles`); `cache clear` ở `backoffice-api-bootstrap` → khóa Redis namespace `parity-bootstrap-b` trống (và ở `directus-bootstrap` → `parity-bootstrap-d` trống); `bootstrap` với `DB_PASSWORD` sai → log
      không chứa bí mật; mọi log không chứa giá trị `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `DB_PASSWORD`, `SECRET`, `KEY` của env.
      (FR-041)
- [ ] T057 [US3] Sửa `deploy/README.md` mục "Lệnh CLI": chạy bằng image Backoffice (`node cli.js <lệnh>` ở `/directus`),
      giữ bảng lệnh, thêm ghi chú vendor ngoài Postgres/SQLite dùng image Directus cho `bootstrap`/`migrate` (D-145), bỏ
      câu "Image Backoffice không có CLI (D-123)" (FR-090).

---

## Phase 8: User Story 8 - `init` (Priority: P3, lượt 2)

**Goal**: `init` hỏi đáp như Directus, chỉ Postgres/SQLite, không `npm install`.

**Independent Test**: `init` trong container với SQLite: `.env` (0640, `SECRET` 32), bảng, admin; so phần hỏi đáp với
Directus.

- [ ] T058 [US8] Kiểm `inquirer` 12 với stdin không TTY trong image (`docker compose exec -T backoffice-api-bootstrap node
      cli.js init` với input dựng sẵn); ghi kết quả vào research R15; nếu không đọc được, chốt cách pseudo-TTY (`script`,
      xem T001 b) hoặc phương án dự phòng (unit test với `inquirer.prompt` giả, parity chỉ so phần không hỏi đáp).
- [ ] T059 [P] [US8] Unit test `api/src/cli/commands/init/index.test.ts` (FR-030..FR-032): danh sách vendor 2 mục,
      không gọi `npm install`, 5 lần thử với thông điệp của Directus, `.env` từ mẫu (D-147) với `SECRET`, `DB_*`, mode
      0640, ghi đè `.env` có sẵn, admin insert thẳng 4 bảng với `randomUUID` và argon2, dòng in cuối `node cli.js start`.
- [ ] T060 [P] [US8] Port `cli/utils/drivers.ts` (chỉ `pg`, `sqlite3`, D-146; nhãn `PostgreSQL / Redshift` nguyên văn),
      `cli/utils/create-db-connection.ts` (nguyên văn), `cli/commands/init/questions.ts` (nguyên văn),
      `cli/utils/create-env/index.ts` (nguyên văn) và `create-env/env-stub.liquid` (chép rồi đổi chữ Directus thành
      Backoffice, bỏ link docs.directus.io; D-147; header dòng 1 là comment Liquid `{%- comment -%}Ported from
      directus/api/src/cli/utils/create-env/env-stub.liquid{%- endcomment -%}` để không in ra `.env`, unit test T059 kiểm
      `.env` không chứa "Ported from") sang `api/src/cli/`; manifest `021-T060.json`; kiểm
      `api/dist/cli/utils/create-env/env-stub.liquid` có sau build (T013). (FR-031)
- [ ] T061 [US8] Port `cli/commands/init/index.ts` sang `api/src/cli/commands/init/index.ts`: bỏ `execa`/`ora` và bước
      `npm install` (D-146), in `Start Backoffice by running:` / `node cli.js start` (D-147); nối vào `cli/index.ts`; T059
      xanh.
- [ ] T062 [US8] `parity/src/bootstrap/init.test.ts` (US8, FR-030..FR-032): theo cách chốt ở T058, chạy `init` trong
      `backoffice-api-bootstrap` ở `/tmp/init` với SQLite; kiểm `.env`, file DB có đủ bảng và 101 migration, admin đăng
      nhập được khi `start` với `.env` đó (cổng tạm); `.env` có sẵn bị ghi đè; so câu hỏi chung với `init` của Directus
      (trừ danh sách vendor, D-146).
- [ ] T063 Đóng lượt 2: lint, typecheck, unit test Phase 7–8 (từng file), `check-port-headers`, image local, parity
      profile `bootstrap` (postgres, sqlite3) local; commit theo đường dẫn; nhắn phiên khác, chờ CI, push; CI xanh;
      `graphify update .`.

---

## Phase 9: User Story 5 - Compose chế độ độc lập (Priority: P2, lượt 3)

**Goal**: `docker-compose.standalone.yml`: service `bootstrap` chạy một lần, replica chỉ `start`, không Directus.

**Independent Test**: `DEPLOY_MODE=standalone pnpm nx run parity-tests:deploy` với 3 replica.

- [ ] T064 [US5] Viết test trước: `parity/src/deploy/instances.ts` thêm `STANDALONE = DEPLOY_MODE === 'standalone'`,
      `composeArgs` thêm `-f docker-compose.standalone.yml`, `instanceUrls` không thêm `directusUrl` khi STANDALONE;
      `parity/src/deploy/instances.test.ts` cho các nhánh mới; `smoke.test.ts` và `compose.test.ts` nhánh standalone
      (không container `directus`, `bootstrap` ExitCode 0, env replica = env bootstrap, `StartedAt` replica >
      `FinishedAt` bootstrap, lb trải đúng REPLICAS upstream, scale 6 → 3 không chạy lại bootstrap); mới
      `parity/src/deploy/standalone.test.ts` (thêm migration bằng `docker compose cp` + `up -d`, `psql` +1 hàng,
      `x-cache-status` MISS; migration `fail/` trên hệ thống đang chạy → `up --wait` lỗi, replica cũ `running` cùng
      `StartedAt`) (FR-070, FR-071, FR-103, SC-005).
- [ ] T065 [US5] Viết `compose/docker-compose.standalone.yml` theo contracts/deploy.md (`directus: profiles:
      [shared-only]`; service `bootstrap` với `env_file: ${DEPLOY_ENV_FILE:-.env}` ghi thẳng vì anchor `*app-env` của file
      gốc không dùng được ở file override; `backoffice-api` `command` start + `depends_on: !reset`; volume `migrations`
      mount `/directus/migrations` ở `bootstrap` và `backoffice-api`; không đặt `MIGRATIONS_PATH` vì mặc định `./migrations`
      đã trỏ tới đó; `lb` mount `./lb/standalone.conf`; kiểm `docker compose -f docker-compose.yml -f
      docker-compose.standalone.yml config` không lỗi) và
      `compose/lb/standalone.conf` (`api_pool` chỉ `backoffice-api`); `parity/src/deploy/global-setup.ts` dựng thêm file
      override khi STANDALONE.
- [ ] T066 [US5] Chạy `DEPLOY_MODE=standalone pnpm nx run parity-tests:deploy` local (3 replica) tới xanh, kể cả các bài
      019 `sessions`, `schema`, `flows-schedule`, `tus`, `shutdown` không Directus; chốt hành vi compose khi `bootstrap` lỗi
      (research R15, CHK036) và ghi vào research "Kết quả lượt 3"; giữ xanh hai chế độ cũ (mặc định, `separate-domain`). (FR-072)
- [ ] T067 [US5] CI job `deploy`: lượt chạy thứ ba `DEPLOY_MODE: standalone` (log khi lỗi, `down -v` luôn chạy với cả file
      override).

---

## Phase 10: User Story 6 - Helm chế độ độc lập (Priority: P2, lượt 3)

**Goal**: `mode: standalone`, Job `bootstrap` hook, Deployment `start`, ConfigMap migration, kiểm tra lúc cài.

**Independent Test**: kind: install từ namespace chỉ có ConfigMap/Secret, upgrade có migration dưới tải, Job lỗi.

- [ ] T068 [US6] Viết test trước trong `chart/ci/test-template.sh` (contracts/tests.md bước 6): render `--set
      mode=standalone --set migrations.configMap=mig`, kubeconform, đếm `secretRef` (2), `helm.sh/hook` (1 Job),
      `parallelism: 1`, `runAsNonRoot`/`allowPrivilegeEscalation` (3 mỗi loại), `args` có `start`; shared không Job,
      không `args`; NOTES hai chế độ; `_checks.tpl` qua `fakeLookup`: standalone thiếu ConfigMap → fail,
      `MIGRATIONS_PATH=/data/mig` với `migrations.configMap` → fail, `./migrations` → ok.
- [ ] T069 [US6] `chart/values.yaml`: `mode: shared`, `bootstrap.backoffLimit: 3`, `bootstrap.activeDeadlineSeconds: 600`,
      `bootstrap.resources: {}`, `migrations.configMap: ''` kèm comment (contracts/deploy.md, FR-080).
- [ ] T070 [US6] `chart/templates/bootstrap-job.yaml` (chỉ `standalone`): hook `pre-install,pre-upgrade`, weight `10`,
      delete-policy `before-hook-creation`, `parallelism: 1`, `completions: 1`, `backoffLimit`, `activeDeadlineSeconds`,
      `restartPolicy: Never`, cùng image, `envFrom`, `securityContext` pod + `backoffice.securityContext`, `resources`
      (`bootstrap.resources` hoặc `api.resources`), volume uploads và migrations, `command: ["node","cli.js","bootstrap"]`
      (FR-081).
- [ ] T071 [US6] `chart/templates/api-deployment.yaml`: `args: ["node","cli.js","start"]` khi `standalone`; volume
      `migrations` (ConfigMap `migrations.configMap`, mount `/directus/migrations`) ở mọi chế độ khi đặt (FR-082, FR-085).
- [ ] T072 [US6] `chart/templates/_checks.tpl`: `standalone` → `lookup` ConfigMap/Secret rỗng khi cài thật → `fail` với
      thông điệp contracts/deploy.md; bỏ kiểm cookie domain ở `standalone`; kiểm `MIGRATIONS_PATH` khi đặt
      `migrations.configMap` (mọi chế độ); giữ FR-053, 020 FR-045 (FR-083, FR-085). `chart/templates/NOTES.txt`: dòng
      chế độ chung (DB phải do Directus bootstrap trước) và dòng `standalone` + `migrations.configMap` (`helm upgrade`
      ngay sau khi đổi ConfigMap). T068 xanh.
- [ ] T073 [US6] `chart/ci/deps-standalone.yaml` (ConfigMap `backoffice-config`, Secret `backoffice-secret`, postgres DB
      `backoffice`, redis, minio + init; không Directus), `chart/ci/values-kind-standalone.yaml` (host `bo.test`, tag `ci`,
      `pullPolicy: Never`); `chart/ci/kind-test.sh` thêm phần standalone bước 1–5, 7 của contracts/tests.md (namespace
      `bo-standalone`, ConfigMap `migrations` từ `parity/fixtures/migrations/ok/20990101A-create-sample.js`, install
      `--wait`, Job Complete trước pod, đăng nhập qua Traefik, `directus_migrations` = 102; thêm file, `helm upgrade`
      dưới tải `ci/load.mjs` ≥ 5.000 request 0 lỗi, = 103; ConfigMap `fail/` → upgrade lỗi, Deployment không đổi; namespace
      `bo-standalone-fail` install lỗi → `failed`, Job còn log, `helm uninstall` được) (FR-084, SC-006). (FR-104)
- [ ] T074 [US6] Chạy `chart/ci/test-template.sh` local và `chart/ci/kind-test.sh` trên kind local (nếu máy đủ tài nguyên;
      không thì CI) tới xanh; đo thời gian thêm vào job `deploy-k8s`; nếu tổng gần 40 phút, tách job
      `deploy-k8s-standalone` trong `.github/workflows/ci.yml` và thêm vào `needs` của `publish` (R12).

---

## Phase 11: Polish & Cross-Cutting (lượt 3)

- [ ] T075 [P] `deploy/README.md`: mục mới "Chạy độc lập" (compose override, Docker Compose ≥ 2.24, Helm `mode:
      standalone`, Job, ConfigMap migration + `helm upgrade` ngay, chạy `bootstrap` ở một nơi, giới hạn XI); sửa "Thay
      image Directus bằng Backoffice" (Postgres/SQLite không cần `directus bootstrap`; vendor khác cần; đổi image nâng
      DB lên 11.17.4, mọi node Directus phải là 11.17.4); phục hồi khi lỗi (DB cài dở, migration lỗi giữa chừng, custom
      migration lỗi, Helm `install` lỗi; FR-015); cảnh báo `migrate:down` migration hệ thống; chế độ chung cần DB do
      Directus bootstrap trước, N replica có thể cùng áp custom migration; SQLite cần mount volume; `init` ghi đè `.env`
      (FR-090). (FR-073)
- [ ] T076 [P] `parity/README.md`: mục profile `bootstrap` (dựng, cổng, DB, chạy `src/bootstrap`, `TEST_DB=sqlite3`).
- [ ] T077 [P] `parity/accepted-differences.ts`: thêm D-145, D-146, D-147 (`feature: '021'`, `kind: 'doc'`, không
      `removeAt`, `reason` từ spec); sửa `reason` của `D-19` (001) và `D-141` (020) theo spec 021; `pnpm nx run
      parity-tests:test` (unit, gồm `accepted-differences.test.ts`) xanh.
- [ ] T078 Sửa spec cũ theo FR-091: `specs/001-platform-foundation/spec.md` dòng D-19; `specs/019-deployment-packaging/spec.md`
      dòng D-121, D-123, US1 kịch bản 4, FR-024, FR-042; `specs/020-extensions/spec.md` dòng D-141 (bỏ phần CLI); mỗi chỗ
      trỏ "xem 021"; kiểm `guard-differences` vẫn đạt.
- [ ] T079 Chạy đo tiêu chí trước khi đóng: parity profile `bootstrap` 10 lần liên tiếp trên postgres (SC-002);
      `DEPLOY_MODE=standalone parity-tests:deploy` 10 lần liên tiếp (SC-005); ghi số đo (thời gian `bootstrap` SC-010,
      ping SC-007) vào research "Kết quả đóng feature"; coverage `apps/api` ≥ 80% (SC-009).
- [ ] T080 [P] Chạy lại các lệnh trong `specs/021-standalone-init-cli/quickstart.md` trên máy local và sửa chỗ sai.
- [ ] T081 Đóng lượt 3 và feature: lint, typecheck, unit test liên quan, `check-port-headers`; spec `**Status**:
      Implemented`; dòng 021 trong `CLAUDE.md` (bỏ "not implemented"); memory `project-021-standalone.md`; commit theo
      đường dẫn; nhắn phiên khác, chờ CI, push; CI xanh mọi job (gồm `deploy` standalone, `deploy-k8s`); `graphify update .`.

---

## Dependencies & Execution Order

### Phase

- Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1) → Phase 4 (US7) → Phase 5 (US2) → Phase 6 (US4) → T044 đóng
  lượt 1.
- Lượt 2: Phase 7 (US3) và Phase 8 (US8) sau lượt 1; T055 trước T061 (cây lệnh rồi `init`); T063 đóng lượt.
- Lượt 3: Phase 9 (US5) và Phase 10 (US6) sau lượt 2 (cần image có CLI đủ); Phase 11 sau 9, 10.

### User story

- US1 cần Phase 2. US7 cần US1 (`bootstrap`, `database`). US2, US4 cần US1 và profile `bootstrap` (T027–T033).
- US3 cần US1 (`cli/index.ts`, `cli.js`). US8 cần US3 (T055).
- US5, US6 cần US1 (CMD, `cli.js start`) và US2 (migration khi khởi động lại); không cần US3, US8 nhưng làm sau để image
  của lượt 3 đủ lệnh.

### Trong một story

- Test trước (chạy đỏ), rồi code; file port: test so nguyên văn trước, rồi chép.
- `cli/index.ts` (T020, T055) sau các lệnh nó khai báo.

## Parallel Example

```bash
# Phase 2 sau T007:
T004 process-chunk (libs/utils) | T005 types settings (libs/types) | T006 types/migration.ts | T009 run.test.ts | T011 seeds + test

# US1 parity (sau T027, T028):
T029 fixtures/migrations | T030 normalize.ts | T031 dump.ts | T032 cli.ts

# US3 tests:
T045 users | T046 roles | T047 cache | T048 count/security | T049 schema | T050 apply-snapshot
```

## Implementation Strategy

### MVP (lượt 1)

1. Phase 1, 2 → seed, migration, `run.ts` có test nguyên văn.
2. Phase 3 (US1) → image tự bootstrap DB trống; parity `bootstrap` so với Directus. **Dừng và kiểm**: `docker run`
   không env, Postgres trống, DB của Backoffice dùng được với Directus.
3. Phase 4 (US7) để CMD mới an toàn trên MySQL/MSSQL/Oracle/CockroachDB của parity, Phase 5–6 (US2, US4) để nâng cấp và
   migrate chéo; đóng lượt 1.

### Tăng dần

- Lượt 2: CLI đủ 16 lệnh + `init` (US3, US8); README "Lệnh CLI".
- Lượt 3: compose và Helm độc lập (US5, US6), tài liệu, sửa spec cũ, đo SC, đóng feature.

## Notes

- 81 task. [P] = khác file, không phụ thuộc task chưa xong.
- Không sửa logic của 101 migration, 15 seed, `run.ts`, `seeds/run.ts`; chỉ header và specifier (FR-025). Thiếu export
  thì port vào lib.
- Mọi khác biệt mới so với Directus phát sinh khi làm phải dừng, ghi vào spec và hỏi chủ dự án (Nguyên tắc X).
