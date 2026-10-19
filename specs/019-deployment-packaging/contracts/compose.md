# Contract: `deploy/compose`

## Lệnh

| Việc | Lệnh (trong `deploy/compose`) |
|------|-------------------------------|
| Sinh `.env` lần đầu | `./init-env.sh` (không ghi đè `.env` đã có) |
| Chung domain, 2 replica | `docker compose up -d --wait` |
| 3 replica (test chấp nhận) | `BACKOFFICE_REPLICAS=3 docker compose up -d --wait` |
| Domain riêng | `docker compose -f docker-compose.yml -f docker-compose.separate-domain.yml up -d --wait` |
| Tắt / xóa dữ liệu | `docker compose down` / `docker compose down -v` |

Image mặc định: `hiennd23/backoffice-{api,web}:${BACKOFFICE_TAG:-latest}`; CI đặt `BACKOFFICE_TAG=ci`.

## Service

| Service | Image | Cổng trên máy | Healthcheck | Phụ thuộc |
|---------|-------|---------------|-------------|-----------|
| `postgres` | `postgis/postgis` (bản như `dev/directus-reference`) | không | `pg_isready` | — |
| `redis` | `redis:7-alpine` | không | `redis-cli ping` | — |
| `minio` | `cgr.dev/chainguard/minio` (như parity; image có sẵn `mc` và shell) | không | `mc ready local` | — |
| `minio-init` | `cgr.dev/chainguard/minio` (như parity: `mc mb --ignore-existing`) | — | thoát 0 sau khi tạo bucket | `minio` healthy |
| `directus` | `directus/directus:11.17.4` | 8095 | `/server/health` | postgres, redis healthy; minio-init xong |
| `backoffice-api` | BE, `platform: linux/amd64`, `deploy.replicas: ${BACKOFFICE_REPLICAS:-2}` | `8055` → cổng ngẫu nhiên mỗi replica | `/server/health` | directus healthy |
| `backoffice-web` | FE, `platform: linux/amd64` | không | `/admin/config.json` | — |
| `lb` | `nginxinc/nginx-unprivileged:1.28.0-alpine` (non-root, FR-025; nghe 8080/8081 trong container) | 8090 → 8080 (và 8091 → 8081 ở chế độ domain riêng) | `nginx -t` lúc khởi động | backoffice-api, backoffice-web healthy |

`stop_grace_period: 30s` cho `backoffice-api` và `directus`.

## Env

- `directus` và `backoffice-api`: `env_file: .env`, không có `environment:` riêng ở chế độ chung domain.
- `backoffice-web`: `env_file: .env` (chỉ đọc `PUBLIC_URL`, `CONTENT_SECURITY_POLICY_*`).
- `.env.example` (khóa chính): `PUBLIC_URL=http://localhost:8090`, `SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DB_*`
  (pg), `REDIS=redis://redis:6379`, `CACHE_ENABLED=true`, `CACHE_STORE=redis`, `CACHE_AUTO_PURGE=true`,
  `RATE_LIMITER_STORE=redis`, `SYNCHRONIZATION_STORE=redis` (lock flow theo lịch, job dọn TUS, retention; mặc định
  Directus là bộ nhớ process), `STORAGE_LOCATIONS=s3`, `STORAGE_S3_*` (MinIO, `FORCE_PATH_STYLE=true`), `TUS_ENABLED=true`,
  `WEBSOCKETS_ENABLED=false`. Secret là chuỗi rỗng trong `.env.example`; `init-env.sh` điền bằng `openssl rand`.
- Domain riêng (`docker-compose.separate-domain.yml`): `backoffice-api` và `backoffice-web` thêm `environment:
  PUBLIC_URL: http://localhost:8091`; `.env` không đổi.

## Định tuyến của `lb`

Chung domain (`lb/shared-domain.conf`), cổng 8090 trên máy (8080 trong container):

| Path | Đích |
|------|------|
| `= /admin`, `/admin/` | `backoffice-web:8080` |
| còn lại | `upstream api_pool { directus:8055; backoffice-api:8055 resolve; }` |

Domain riêng (`lb/separate-domain.conf`):

| Cổng trên máy (trong container) | Path | Đích |
|---------------------------------|------|------|
| 8090 (8080) | mọi path (kể cả `/admin` của Directus) | `directus:8055` |
| 8091 (8081) | `= /admin`, `/admin/` | `backoffice-web:8080` |
| 8091 (8081) | còn lại | `upstream bo_pool { backoffice-api:8055 resolve; }` |

Chung cho mọi `location` proxy: `proxy_http_version 1.1`, không `keepalive` tới upstream, `proxy_next_upstream error
timeout`, `client_max_body_size 0`, `proxy_request_buffering off`, `proxy_read_timeout 300s`, header `Host`,
`X-Forwarded-For`, `X-Forwarded-Proto` (FR-035, FR-051).
