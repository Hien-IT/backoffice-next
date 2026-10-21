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

| Service | Image | DB | Cổng | Ghi chú |
|---------|-------|----|------|---------|
| `postgres-bootstrap` | `postgis/postgis:13-3.4-alpine` | tạo `directus_bootstrap`, `backoffice_bootstrap` (init SQL) | 6114 | profile `bootstrap` |
| `directus-bootstrap` | `directus/directus:11.17.4` | `directus_bootstrap` | 10755 | không depends_on app khác |
| `backoffice-api-bootstrap` | `hiennd23/backoffice-api:local` (CMD mặc định) | `backoffice_bootstrap` | 10756 | |
| `directus-on-backoffice-db` | Directus | `backoffice_bootstrap` | 10757 | depends_on `backoffice-api-bootstrap` healthy |

Env `env/profile-bootstrap-postgres.env` / `-sqlite3.env` (chọn bằng `${TEST_DB:-postgres}`): `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `ADMIN_TOKEN`, `PROJECT_NAME=Bootstrap Parity`, `PROJECT_OWNER=owner@example.com`,
`REDIS=redis://redis:6379/10`, `CACHE_NAMESPACE=parity-bootstrap`, `REDIS_BUS_NAMESPACE=parity-bootstrap:bus`,
`REDIS_LOCK_NAMESPACE=parity-bootstrap:lock`, `LOG_STYLE=raw`, `MIGRATIONS_PATH=/directus/migrations`,
`COMPLIANCE_URL=http://registry:9100` (registry giả đếm owner report, mọi app `depends_on: registry`), `CACHE_ENABLED=true`,
`CACHE_STORE=redis`, `CACHE_STATUS_HEADER=x-cache-status`; sqlite3:
`DB_CLIENT=sqlite3`, `DB_FILENAME=/directus/database/bootstrap/directus.db` | `backoffice.db`, bind `./.data/bootstrap`.
Bind `./fixtures/migrations:/directus/migrations:ro` (ba app).

`config.ts`: `profilePorts.bootstrap = { directus: 10755, backoffice: 10756 }`, `bootstrapDbPort = 6114`,
`bootstrapCrossPort = 10757`. `global-setup.ts` tự đặt `DIRECTUS_URL_BOOTSTRAP`/`BACKOFFICE_URL_BOOTSTRAP`.

| Test | FR | Nội dung |
|------|----|----------|
| `src/bootstrap/schema.test.ts` | FR-100, FR-014, FR-010 | sau khi cả hai app healthy: `dump(db)` hai DB, mọi bảng `directus_*` (không loại bảng nào): cột (`columnInfo`: tên, kiểu, nullable, default, max_length, precision, scale), PK, FK (gồm `on_delete`), index (`indexesOf`), hàng sắp theo PK; chuẩn hóa FR-107 (`normalize.ts`); `diffJson` = []; `directus_migrations` 101 hàng, cùng `version`, `name`, thứ tự; registry `/v1/owner`: Directus +2, Backoffice +0 và 2 dòng log D-38; log không chứa bí mật (FR-016) |
| `src/bootstrap/cross.test.ts` | FR-035, FR-101, SC-004 | 10757 (Directus trên DB Backoffice): `/server/health` không `error`, log không có `Database migrations have not all been run`, đăng nhập admin, tạo collection + item, `cli('directus-on-backoffice-db', ['database','migrate:latest'])` → `Database up to date`, không `Applying`; `migrate:down` ở Directus rồi `migrate:up` ở Backoffice (và ngược) với `MIGRATIONS_PATH=/directus/migrations/ok`; so hàng và schema sau mỗi bước; `collide`, `nodash`, `noup` theo US4; cache: collection `bo_bootstrap_cache`, `GET /items/bo_bootstrap_cache` hai lần mỗi app (lần hai HIT), sau mỗi bước migrate lần đầu MISS ở cả hai app |
| `src/bootstrap/partial.test.ts` | FR-015 | hai DB thêm trên `postgres-bootstrap`: `database install` bằng image Directus trên cả hai, `DROP TABLE directus_fields` ở cả hai; `bootstrap` bằng image Directus trên DB một và image Backoffice trên DB hai → cùng mã thoát (1), cùng dòng log lỗi sau chuẩn hóa FR-107, cùng `directus_migrations` sau lần chạy (giống Directus) |
| `src/bootstrap/cli.test.ts` | FR-102, FR-050..FR-059, FR-016 | mỗi lệnh chạy ở `directus-bootstrap` và `backoffice-api-bootstrap` với cùng tham số (DB riêng, cùng trạng thái); so `{ code, stdout, logs }` sau chuẩn hóa FR-107; `--help` của chương trình và từng lệnh, lệnh/option không tồn tại; tác động DB (`users`, `roles`, `cache clear` → Redis trống); `bootstrap` với `DB_PASSWORD` sai: log không chứa bí mật |
| `src/bootstrap/init.test.ts` | FR-030..FR-032, US8 | `init` trong container Backoffice (`/tmp/init`), SQLite, nhập qua stdin (`compose exec -T`); nếu `inquirer` không đọc stdin không TTY thì dưới pseudo-TTY (`script`), quyết ở lượt 2 (research R15); `.env` (mode 0640, `SECRET` 32, `DB_*`, ghi đè `.env` có sẵn), bảng, admin; Directus `init` chỉ so phần câu hỏi chung (danh sách vendor khác là D-146) |
| `src/bootstrap/vendor.test.ts` | FR-008, FR-026 | chỉ khi `TEST_DB=mysql`: `cli('backoffice-api', ['database','migrate:latest'])` mã 1 với thông điệp D-145; `bootstrap` DB đã cài → mã 0, không `Applying` |

Helper `src/bootstrap/cli.ts`: `cli(service, args, env?: Record<string,string>, stdin?: string) → { code, stdout,
stderr }` qua `execFileSync('docker', ['compose', '-p', ..., 'exec', '-T', ...(env → '-e'), service, 'node', 'cli.js',
...args])`, bắt `status` từ lỗi. `src/bootstrap/normalize.ts`: thương hiệu, phiên bản, pino `time/pid/hostname`, uuid,
argon2. `src/bootstrap/dump.ts`: schema + hàng.

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
