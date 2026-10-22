# Contract: image, compose độc lập, Helm

## Image API

| Mục | Giá trị |
|-----|---------|
| `ENTRYPOINT` | `["/sbin/tini", "--"]` (019) |
| `CMD` | `["/bin/sh", "-c", "node cli.js bootstrap && exec node cli.js start"]` |
| `WORKDIR` | `/directus`; `cli.js` ở `/directus/cli.js` |
| env mặc định | `DB_CLIENT=sqlite3`, `DB_FILENAME=/directus/database/database.sqlite` (như image Directus) → `docker run` không env bootstrap SQLite |
| thư mục | `database/`, `extensions/`, `uploads/`, `migrations/` (mặc định `MIGRATIONS_PATH=./migrations`) |
| tiến trình | `bootstrap`: tini → sh → node; `start`: tini → node (`exec`) |
| mã thoát | `bootstrap` ≠ 0 → container thoát mã đó, không `start`; SIGTERM khi `start` → 143 (019) |
| ghi đè | `command: ["node", "cli.js", "start"]` (compose) / `args: ["node", "cli.js", "start"]` (k8s) bỏ `bootstrap`; `node dist/main.js` vẫn chạy (019) |

## Compose: `docker-compose.standalone.yml` (override trên `docker-compose.yml`)

```yaml
services:
  directus:
    profiles: [shared-only]            # tắt: không có Directus
  bootstrap:
    env_file: ${DEPLOY_ENV_FILE:-.env} # anchor *app-env của file gốc không dùng được ở file override
    image: hiennd23/backoffice-api:${BACKOFFICE_TAG:-latest}
    platform: linux/amd64
    command: ["node", "cli.js", "bootstrap"]
    restart: "no"
    volumes: [migrations:/directus/migrations]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
      minio-init: { condition: service_completed_successfully }
  backoffice-api:
    command: ["node", "cli.js", "start"]
    volumes: [migrations:/directus/migrations]
    depends_on: !override
      bootstrap: { condition: service_completed_successfully }
      redis: { condition: service_healthy }
      minio-init: { condition: service_completed_successfully }
  lb:
    volumes: !override
      - ./lb/standalone.conf:/etc/nginx/conf.d/default.conf:ro
volumes:
  migrations: {}
```

- Lệnh: `docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --wait`; `BACKOFFICE_REPLICAS=3`.
- Anchor YAML (`x-app-env: &app-env`) chỉ có hiệu lực trong file khai báo nó, nên service mới `bootstrap` ghi lại
  `env_file` cùng giá trị; các service có sẵn (`backoffice-api`, `lb`) được gộp với file gốc nên giữ `env_file` của chúng.
- Không đặt `MIGRATIONS_PATH` trong override: mặc định `./migrations` ở `WORKDIR /directus` đã là `/directus/migrations`,
  chỗ volume `migrations` được mount; env vẫn chỉ đến từ `.env` (spec FR-070, Nguyên tắc VIII).
- `lb/standalone.conf`: như `shared-domain.conf` nhưng `api_pool` chỉ `backoffice-api:8055 resolve`; `/admin` → web;
  `/extensions/sources/` → `bo_pool` (= api_pool).
- Thêm migration: `docker compose cp <file> bootstrap:/directus/migrations/` (hoặc mount bind riêng) rồi `up -d` lại:
  `bootstrap` chạy lại, replica khởi động lại sau khi xong.
- Cổng: lb 8090; không có 8095.
- Chế độ chung, `separate-domain`, `shared-extensions`: không đổi; replica dùng CMD image (bootstrap rồi start).
- `!override` (Compose ≥ 2.24.4), không phải `!reset`: `!reset` kèm giá trị xóa trống thuộc tính (kiểm khi làm T065:
  replica chạy trước khi `bootstrap` xong).
- `up --wait` với `bootstrap` đã thoát 0: đạt (T066). Mỗi `up -d` chạy lại `bootstrap`; replica đang chạy không bị
  khởi động lại (spec US5 kịch bản 2, câu chữ duyệt 2026-10-22). Scale: `--no-deps`, nếu không `bootstrap` chạy lại.

## Helm values mới (`deploy/helm/backoffice/values.yaml`)

| Key | Mặc định | Ý nghĩa |
|-----|----------|---------|
| `mode` | `shared` | `shared`: như 019 (pod chạy CMD image, không Job, kiểm pool/cookie); `standalone`: Job bootstrap, pod `start`, không Directus |
| `bootstrap.backoffLimit` | `3` | Job |
| `bootstrap.activeDeadlineSeconds` | `600` | Job (ít nhất gấp 3 thời gian `bootstrap` của SC-010) |
| `bootstrap.resources` | `{}` → dùng `api.resources` | Job |
| `migrations.configMap` | `""` | ConfigMap chứa custom migration (`.js`), mount `/directus/migrations` ở Job và Deployment (cả hai chế độ) |
| `directus.configMap` / `directus.secret` | (bắt buộc) | như 019; ở `standalone` là ConfigMap/Secret env Backoffice (định dạng Directus) do đội vận hành tạo trước |

Không key nào nhận map env tự do (019 FR-046 giữ).

## Tài nguyên sinh ra theo chế độ

| Resource | `shared` | `standalone` |
|----------|----------|--------------|
| Deployment api | như 019; không `args` (CMD image) | `args: ["node", "cli.js", "start"]`; volume `migrations` nếu đặt |
| Job `<release>-bootstrap` | không | có: hook `pre-install,pre-upgrade`, weight `10`, delete-policy `before-hook-creation`, `parallelism: 1`, `completions: 1`, `restartPolicy: Never`, `backoffLimit`, `activeDeadlineSeconds`, cùng image/envFrom, cùng `securityContext` pod (uid/gid 1000, `runAsNonRoot`, `fsGroup`) và container (`backoffice.securityContext`: `allowPrivilegeEscalation: false`, drop `ALL`) như Deployment, `resources` theo `bootstrap.resources`, volumes (uploads, migrations), `args: ["node", "cli.js", "bootstrap"]` (args, không `command`: giữ `tini`, như Deployment) |
| Service api, api-only, web, Ingress, HPA | như 019 | như 019 (pool chỉ có pod Backoffice) |
| NOTES | như 019, thêm: `The database must be bootstrapped by Directus before Backoffice pods start (shared mode).` | không hướng dẫn gắn nhãn Directus; khi đặt `migrations.configMap`: `After changing the migrations ConfigMap, run helm upgrade right away.` |

## Kiểm tra lúc cài (`_checks.tpl`)

| Kiểm | `shared` | `standalone` |
|------|----------|--------------|
| ConfigMap/Secret tồn tại (lookup) | như 019 (chỉ `required` tên) | `fail` nếu lookup rỗng khi cài thật: `ConfigMap "<n>" not found in namespace <ns>: create the Backoffice env ConfigMap and Secret before "helm install"` |
| Redis, `CACHE_STORE`, `RATE_LIMITER_STORE`, `SYNCHRONIZATION_STORE`, `SECRET`, `DB_CLIENT` ≠ sqlite, storage (019 FR-053) | có | có |
| `EXTENSIONS_LOCATION` khi nhiều replica (020 FR-045) | có | có |
| cookie domain với `domain.publicUrl` (019 FR-076) | có | không (không có domain Directus) |
| `MIGRATIONS_PATH` khi đặt `migrations.configMap` (spec FR-085) | có | có: env có `MIGRATIONS_PATH` khác `./migrations`, `migrations`, `/directus/migrations` → `fail`: `MIGRATIONS_PATH="<v>" in <ConfigMap/Secret n> does not point to /directus/migrations, where migrations.configMap is mounted: remove the variable or set it to ./migrations, then install again.` |

## Trình tự Helm (`standalone`)

```text
helm install:  checks → Job bootstrap (pre-install) → Complete → Deployment, Service, Ingress, HPA → pod start Ready
helm upgrade:  checks → Job bootstrap (pre-upgrade, Job cũ bị thay) → Complete → rolling update (pod cũ phục vụ tới khi pod mới Ready)
Job Failed:    upgrade: Helm lỗi; release đang chạy giữ nguyên; `kubectl logs job/<release>-bootstrap`
               install đầu: release `failed`, không Deployment; sửa nguyên nhân (DB mới bị cài dở hoặc migration lỗi
               giữa chừng: xóa và tạo lại DB, spec FR-015), `helm uninstall` rồi `helm install`
```

Chế độ chung trên DB trống: điều kiện trước 019 FR-024 (Directus bootstrap trước); nếu không, Directus và pod
Backoffice cùng seed, bên sau lỗi rồi khởi động lại (như N pod Directus).

Đổi ConfigMap migration mà không `helm upgrade`: không migration nào chạy; pod mới (HPA) thấy file chưa chạy → `start`
dừng (001) → tài liệu yêu cầu `helm upgrade` ngay sau khi đổi ConfigMap.
