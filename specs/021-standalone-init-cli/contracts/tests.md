# Contract: test đối chiếu, test chấp nhận, CI

## Unit (`apps/api`, Vitest, không Docker)

| File | Kiểm |
|------|------|
| `database/migrations/run.test.ts` | port 8 test Directus (`knex-mock-client`): up/down/latest, `Nothing to upgrade/downgrade` |
| `database/migrations/port.test.ts` | 101 file = bản Directus sau khi bỏ header và áp bảng specifier; tập version = `DIRECTUS_MIGRATIONS` |
| `database/seeds/run.test.ts` | 15 yaml = bản Directus (bỏ dòng 1); sqlite in-memory tạo 15 bảng; `Database is already installed` |
| `cli/index.test.ts` | cây lệnh, option, mặc định, `--help`/`--version` (snapshot), `cli.before`/`cli.after` phát |
| `cli/commands/*.test.ts` | mỗi lệnh với mock DB/service: exit code, stdout, log, thông điệp lỗi; `assertBootstrapVendor` |
| `cli/commands/bootstrap/index.test.ts` | chờ DB 5×5 s (fake timers), nhánh trống/đã cài/`--skipAdminInit`/vendor khác (gồm `redshift`) |
| `config/supported-variables.test.ts` | `PROJECT_OWNER`, `ACCEPT_TERMS` hỗ trợ |
| `libs/utils` `process-chunk.test.ts` | port test Directus |

Coverage `apps/api` ≥ 80% (cli, seeds, `migrations/run.ts` tính vào; 101 migration được chạy thật ở parity, unit chỉ kiểm
nguyên văn, nên cấu hình coverage loại `src/database/migrations/2*.ts` khỏi mẫu số, ghi lý do trong `vitest.config.ts`;
spec FR-106).

## Parity profile `bootstrap` (`tests/parity`)

| Service | Image | DB | Redis db / namespace | Cổng | Ghi chú |
|---------|-------|----|----------------------|------|---------|
| `postgres-bootstrap` | `postgis/postgis:13-3.4-alpine` | init SQL `env/bootstrap-init.sql` tạo `directus_bootstrap`, `backoffice_bootstrap`, `directus_partial`, `backoffice_partial` | — | 6114 | profile `bootstrap` |
| `directus-bootstrap` | `directus/directus:11.17.4` | `directus_bootstrap` / `directus.db` | 10 / `parity-bootstrap-d` | 10755 | không `depends_on` app khác |
| `backoffice-api-bootstrap` | `hiennd23/backoffice-api:local` (CMD mặc định) | `backoffice_bootstrap` / `backoffice.db` | 11 / `parity-bootstrap-b` | 10756 | |
| `directus-on-backoffice-db` | Directus | `backoffice_bootstrap` / `backoffice.db` | 11 / `parity-bootstrap-b` | 10757 | `depends_on` `backoffice-api-bootstrap` healthy; cùng DB nên cùng namespace (cache, bus, lock chung như 019) |

Khóa cache response và schema chỉ phụ thuộc request và namespace, không phụ thuộc DB (`apps/api/src/utils/get-cache-key.ts`),
nên app trên DB khác PHẢI có Redis db và namespace khác; pub/sub bỏ qua số db, nên bus cũng phải có namespace riêng (như
profile `setup` của 010).

Env chung `env/profile-bootstrap-postgres.env` / `-sqlite3.env` (chọn bằng `${TEST_DB:-postgres}`): `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `ADMIN_TOKEN`, `PROJECT_NAME=Bootstrap Parity`, `PROJECT_OWNER=owner-bootstrap@example.com` (email riêng
để registry đếm report của profile này), `LOG_STYLE=raw`, `COMPLIANCE_URL=http://registry:9100` (mọi app `depends_on:
registry`), `CACHE_ENABLED=true`, `CACHE_STORE=redis`, `CACHE_STATUS_HEADER=x-cache-status`, `KEY` (uuid cố định của test,
để kiểm FR-016 cả biến này); Postgres: `DB_HOST=postgres-bootstrap`;
SQLite: `DB_CLIENT=sqlite3`, bind `./.data/bootstrap:/directus/database/bootstrap`.

Phần riêng từng service đặt trong khối `environment:` của service (một file env không cho mỗi service một giá trị):
`DB_DATABASE` (Postgres), `DB_FILENAME=/directus/database/bootstrap/<directus|backoffice>.db` (SQLite; vendor kia bỏ qua
biến không dùng), `PUBLIC_URL=http://localhost:<cổng>`, `REDIS=redis://redis:6379/<10|11>`, `CACHE_NAMESPACE`,
`REDIS_BUS_NAMESPACE=<ns>:bus`, `REDIS_LOCK_NAMESPACE=<ns>:lock` theo bảng trên, và
`MIGRATIONS_PATH: ${BOOTSTRAP_MIGRATIONS_DIR:-/directus/migrations}`. Bind `./fixtures/migrations:/directus/migrations:ro`
(ba app); thư mục gốc không có file migration nên mặc định không có custom migration.

Đổi custom migration khi khởi động lại container: test đặt `process.env.BOOTSTRAP_MIGRATIONS_DIR=/directus/migrations/ok`
rồi gọi `compose('up', '-d', '--force-recreate', '--wait', <service>)` (`execFileSync` của `src/docker.ts` kế thừa
`process.env`, compose nội suy biến khi tạo container), sau đó xóa biến và tạo lại để về trạng thái mặc định. Lệnh CLI chạy
qua `exec` thì truyền `-e MIGRATIONS_PATH=...` (helper `cli()`).

`config.ts`: `profilePorts.bootstrap = { directus: 10755, backoffice: 10756 }`, `bootstrapDbPort = 6114`,
`bootstrapCrossPort = 10757`. `global-setup.ts` tự đặt `DIRECTUS_URL_BOOTSTRAP`/`BACKOFFICE_URL_BOOTSTRAP`.

**Baseline (cô lập test)**: các file `cross`, `cli`, `partial`, `init` ghi vào DB của profile, còn Vitest không bảo đảm thứ
tự file. Vì vậy trạng thái ngay sau bootstrap được chụp một lần trong `parity/src/global-setup.ts` khi có
`profileUrls('bootstrap')`, bằng `parity/src/bootstrap/baseline.ts`: `dump()` hai DB (`directus_bootstrap`,
`backoffice_bootstrap` hoặc hai file SQLite), log khởi động (`level`, `msg`) của `directus-bootstrap` và
`backoffice-api-bootstrap` (`docker compose logs`), số owner report của `owner-bootstrap@example.com` từ registry
(`GET /v1/owner` của `registry-bootstrap`); ghi vào `parity/.data/bootstrap/baseline.json`.
`schema.test.ts` chỉ đọc file này, không đọc DB đang chạy. Owner report của profile đến service riêng
`registry-bootstrap` (cổng 6115, cùng `parity/registry/server.mjs`), nên `count` của nó chỉ thuộc profile này (đổi khi
làm T033: không sửa và không khởi động lại registry chung).

| Test | FR | Nội dung |
|------|----|----------|
| `src/bootstrap/schema.test.ts` | FR-100, FR-014, FR-010 | đọc `baseline.json` (chụp trong global-setup ngay sau khi cả hai app healthy): dump hai DB, mọi bảng `directus_*` (không loại bảng nào): cột (`columnInfo`: tên, kiểu, nullable, default, max_length, precision, scale), PK, FK (gồm `on_delete`), index (`indexesOf`), hàng sắp theo PK; chuẩn hóa FR-107 (`normalize.ts`); `diffJson` = []; `directus_migrations` 101 hàng, cùng `version`, `name`, thứ tự; registry: 2 report cho `owner-bootstrap@example.com` (đều từ Directus), log khởi động của Backoffice có 2 dòng D-38; log khởi động không chứa giá trị `ADMIN_PASSWORD`, `ADMIN_TOKEN`, `DB_PASSWORD`, `SECRET`, `KEY` (FR-016) |
| `src/bootstrap/cross.test.ts` | FR-035, FR-101, SC-004 | 10757 (Directus trên DB Backoffice): `/server/health` không `error`, log không có `Database migrations have not all been run`, đăng nhập admin, tạo collection + item, `cli('directus-on-backoffice-db', ['database','migrate:latest'])` → `Database up to date`, không `Applying`; với `MIGRATIONS_PATH=/directus/migrations/ok` (`cli()` truyền `-e`): `migrate:down` ở Directus (10757) rồi `migrate:up` ở Backoffice và ngược lại trên cùng DB `backoffice_bootstrap`, so hàng và schema sau mỗi bước; `collide`, `nodash`, `noup` theo US4 ở cả `directus-bootstrap` và `backoffice-api-bootstrap`; cache: collection `bo_bootstrap_cache`, `GET /items/bo_bootstrap_cache` hai lần ở 10756 và 10757 (cùng DB, cùng namespace; lần hai HIT), sau mỗi bước migrate lần đầu MISS ở cả hai |
| `src/bootstrap/partial.test.ts` | FR-015 | hai DB thêm trên `postgres-bootstrap`: `database install` bằng image Directus trên cả hai, `DROP TABLE directus_fields` ở cả hai; `bootstrap` bằng image Directus trên DB một và image Backoffice trên DB hai → cùng mã thoát (1), cùng dòng log lỗi sau chuẩn hóa FR-107, cùng `directus_migrations` sau lần chạy (giống Directus) |
| `src/bootstrap/cli.test.ts` | FR-102, FR-050..FR-059, FR-016 | mỗi lệnh chạy ở `directus-bootstrap` và `backoffice-api-bootstrap` với cùng tham số (DB riêng, cùng trạng thái); so `{ code, stdout, logs }` sau chuẩn hóa FR-107; `--help` của chương trình và từng lệnh, lệnh/option không tồn tại; tác động DB (`users`, `roles`, `cache clear` → Redis trống); `bootstrap` với `DB_PASSWORD` sai: log không chứa bí mật |
| `src/bootstrap/init.test.ts` | FR-030..FR-032, US8 | `init` trong container Backoffice (`/tmp/init`), SQLite, nhập qua stdin (`compose exec -T`); nếu `inquirer` không đọc stdin không TTY thì dưới pseudo-TTY (`script`), quyết ở lượt 2 (research R15); `.env` (mode 0640, `SECRET` 32, `DB_*`, ghi đè `.env` có sẵn), bảng, admin; Directus `init` chỉ so phần câu hỏi chung (danh sách vendor khác là D-146) |
| `src/bootstrap/vendor.test.ts` | FR-008, FR-026 | chỉ khi `TEST_DB=mysql`, không khởi động lại cặp chính: log khởi động của `backoffice-api` (`docker compose logs`, CMD mới đã chạy `bootstrap` lúc env up) có `Database on mysql is migrated by Directus 11.17.4 (D-145); skipping migrations` và không `Applying`; `cli('backoffice-api', ['database','migrate:latest'])` (exec trong container đang chạy) mã 1 với thông điệp D-145; `docker compose run --rm --no-deps backoffice-api node cli.js bootstrap` (container tạm, cùng DB) mã 0, không `Applying` |

Helper `src/bootstrap/cli.ts`: `cli(service, args, env?: Record<string,string>, stdin?: string) → { code, stdout,
stderr }` qua `execFileSync('docker', ['compose', '-p', ..., 'exec', '-T', ...(env → '-e'), service, 'node', 'cli.js',
...args])`, bắt `status` từ lỗi. `src/bootstrap/normalize.ts`: đúng danh sách spec FR-107. `src/bootstrap/dump.ts`:
schema + hàng. `src/bootstrap/baseline.ts`: chụp và đọc `baseline.json` (mục Baseline ở trên).

Fixture `tests/parity/fixtures/migrations/`:

| Thư mục | File | Mục đích |
|---------|------|----------|
| `ok/` | `20990101A-create-sample.js`, `20990102A-add-column-default.js`, `20990103A-in-transaction.js` | latest/up/down chéo |
| `collide/` | `20201028A-collide.js` | trùng version hệ thống |
| `nodash/` | `utils.js`, `20990104A-ts-ignored.ts` | bị bỏ qua |
| `noup/` | `20990105A-no-up.js` (chỉ `down`) | cảnh báo rồi lỗi |
| `fail/` | `20990106A-throws.js` | Job lỗi (kind) |

Suite: `src/bootstrap/**/*.test.ts` vào `FULL_FILES` và `REDUCED_FILES`; profile `bootstrap` vào `ALL_PROFILES`
(`scripts/env.mjs`), `compose()` (`src/docker.ts`), CI `parity` matrix (postgres 2 shard, sqlite3; mysql chỉ
`vendor.test.ts` qua cặp chính).

## Deploy (`parity-tests:deploy`)

| Chế độ | File | Kiểm |
|--------|------|------|
| `DEPLOY_MODE=standalone` | `smoke.test.ts` | REPLICAS replica, không container `directus`, `bootstrap` ExitCode 0, lb health, `/admin/config.json` |
| | `compose.test.ts` | env replica = env bootstrap; `StartedAt` replica > `FinishedAt` bootstrap; lb trải đúng REPLICAS upstream; scale 6 → 3 không chạy lại bootstrap |
| | `standalone.test.ts` (mới) | `docker compose cp fixtures/migrations/ok/20990101A-*.js bootstrap:/directus/migrations/` → `up -d` → bootstrap chạy lại, replica restart sau, `psql` `directus_migrations` +1, `x-cache-status` MISS; `bootstrap` lỗi giả lập (`fail/`) trên hệ thống đang chạy → `up --wait` lỗi, replica cũ vẫn `running` với cùng `StartedAt` (US5 kịch bản 3) |
| | 019 `sessions`, `schema`, `flows-schedule`, `tus`, `shutdown` | chạy không có Directus trong pool (`instanceUrls` không thêm `directusUrl` khi STANDALONE) |
| chế độ chung | `image-swap.test.ts` | "stops on a database Directus never bootstrapped" → "bootstraps an empty database": container healthy, đăng nhập, `directus_migrations` = 101; thêm: `node cli.js --version` in phiên bản Backoffice |

CI job `deploy`: lượt 3 `DEPLOY_MODE=standalone`.

## kind (`deploy-k8s`)

`ci/kind-test.sh` thêm sau phần chế độ chung:

1. `kubectl create ns bo-standalone`; `ci/deps-standalone.yaml` (ConfigMap `backoffice-config`, Secret
   `backoffice-secret`, postgres (DB `backoffice`), redis, minio + init; không Directus).
2. `kubectl -n bo-standalone create configmap migrations --from-file=tests/parity/fixtures/migrations/ok/20990101A-create-sample.js`.
3. `helm install bo-sa . -n bo-standalone -f ci/values-kind-standalone.yaml --set mode=standalone --set
   migrations.configMap=migrations --wait --timeout 10m`; Job `bo-sa-bootstrap` Complete trước khi Deployment có pod;
   đăng nhập qua Traefik host `bo.test`; `psql` `directus_migrations` = 102.
4. Thêm file `20990102A-...` vào ConfigMap (`kubectl create configmap --dry-run -o yaml | kubectl apply`), `helm upgrade`
   dưới tải (`ci/load.mjs`): 0 lỗi; `directus_migrations` = 103; Job mới, Job cũ đã bị thay.
5. ConfigMap `fail/` → `helm upgrade` lỗi; `kubectl rollout status` Deployment không đổi; `helm history` release vẫn
   bản trước; log Job còn.
6. `ci/test-template.sh`: render `--set mode=standalone --set migrations.configMap=mig`, kubeconform, đếm `secretRef`
   (2), `helm.sh/hook` (1 Job), `parallelism: 1`, `runAsNonRoot` và `allowPrivilegeEscalation` (3 mỗi loại: web, api,
   Job), `args:` `start` có mặt; shared: không Job, không `args`; NOTES hai chế độ có dòng của contracts/deploy.md;
   `_checks.tpl` qua `fakeLookup`: standalone thiếu ConfigMap → `expect_fail`; `MIGRATIONS_PATH=/data/mig` với
   `migrations.configMap` → `expect_fail`; `MIGRATIONS_PATH=./migrations` → `expect_ok`.
7. Lần đầu cài lỗi: namespace `bo-standalone-fail` với ConfigMap trỏ DB không tồn tại, `helm install --timeout 3m` lỗi,
   `helm status` là `failed`, không có Deployment, Job còn log; `helm uninstall` thành công.

## Ba lượt lên `main` (theo research R13)

| Lượt | Gồm | CI phải xanh |
|------|-----|--------------|
| 1 | seed, 101 migration, `run.ts`, `bootstrap`, `database`, `start`, `cli.js`, Dockerfile, deps, port manifest, `PROJECT_OWNER`/`ACCEPT_TERMS`, profile `bootstrap` (`schema`, `cross`, `partial`), `image-swap` sửa, D-145, FR-016 | quality, parity (postgres, sqlite3), docker, deploy, deploy-k8s |
| 2 | `users`, `roles`, `cache`, `count`, `schema`, `security`, `init`, `load-extensions`, `cli.test.ts`, `init.test.ts`, README "Lệnh CLI", D-146, D-147 | như trên |
| 3 | compose standalone, Helm mode/Job/ConfigMap, kind, deploy standalone, README "Chạy độc lập", spec cũ, `accepted-differences.ts` | như trên + deploy standalone |
