# Contract: `deploy/compose` sau 026

Bố cục FR-001 là mặc định của `docker-compose.yml`, không còn file override domain riêng. Mọi service, volume, healthcheck,
thứ tự khởi động của 019 giữ nguyên; chỉ `lb`, env của hai service Backoffice và phần chú thích đổi.

## Cổng và định tuyến (FR-005, Q3)

| Cổng máy | Cổng container `lb` | Domain | Định tuyến |
|----------|---------------------|--------|------------|
| 8090 | 8080 | D (Directus) | mọi path → `directus:8055` (Directus app ở `/admin` của chính Directus) |
| 8091 | 8081 | B (Backoffice) | `= /admin`, `/admin/` → `backoffice-web:8080`; còn lại → upstream `bo_pool` = `backoffice-api:8055 resolve max_fails=0` |
| 8095 | — | — | `directus:8055` gọi thẳng (FR-044 của 019) |
| ngẫu nhiên | — | — | mỗi replica `backoffice-api` (`docker compose port --index <i> backoffice-api 8055`) |

- Upstream của domain B không có `directus`. Các chỉ thị proxy của 019 (`proxy_next_upstream error timeout http_503`,
  `proxy_connect_timeout 1s`, `client_max_body_size 0`, `proxy_request_buffering off`, `proxy_read_timeout 300s`,
  header `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`, `Connection ""`, `error_page 502 504 = @retry`) giữ nguyên ở
  domain B (FR-002: FR-051, FR-035 của 019).
- Không còn `location` riêng cho `/extensions/sources/`, `/permissions/me`, `/backoffice/` (FR-009): ba path đó đi
  `location /` của domain B.
- Log truy cập `$remote_addr "$request" $status $upstream_addr $upstream_status $server_port` (cột `$server_port` như
  `separate-domain.conf` cũ, để test tách domain theo cổng).

## File

| File | Sau 026 |
|------|---------|
| `docker-compose.yml` | `lb.ports`: `8090:8080`, `8091:8081`; `lb.volumes`: `./lb/shared.conf`; `backoffice-api.environment.PUBLIC_URL`, `backoffice-web.environment.PUBLIC_URL` = `http://localhost:8091`; chú thích đầu file mô tả hai domain |
| `lb/shared.conf` | nội dung `lb/separate-domain.conf` cũ (hai `server`), đổi tên theo `mode: shared` của Helm (chạy cạnh Directus, Q4); chú thích đầu file nêu spec 026 FR-001, FR-002 |
| `lb/shared-domain.conf` | xóa |
| `lb/separate-domain.conf` | xóa (đổi tên thành `lb/shared.conf`) |
| `docker-compose.separate-domain.yml` | xóa |
| `docker-compose.standalone.yml` | thêm `lb.ports: !override ['8090:8080']` (không mở 8091) và `backoffice-api.environment: !reset`, `backoffice-web.environment: !reset` để `PUBLIC_URL` về giá trị của `.env` (Backoffice một mình ở 8090, FR-011); phần còn lại không đổi |
| `docker-compose.shared-extensions.yml`, `docker-compose.eticket.yml`, `init-env.sh`, `.env.example`, `.env.deploy-test` | không đổi (`PUBLIC_URL=http://localhost:8090` là của Directus) |
| `lb/standalone.conf` | không đổi (FR-011; `location /extensions/sources/` của nó trỏ cùng pool, vô hại) |

## Bất biến kiểm được (test `compose.test.ts`, `domains.test.ts`)

- `docker compose config --format json`: `services.backoffice-api.environment` và `services.backoffice-web.environment`
  khác `services.directus.environment` đúng một khóa `PUBLIC_URL` = `http://localhost:8091` (US1 kịch bản 3).
- 50 request `GET /server/info` tới 8091: mọi `$upstream_addr` là IP của một replica `backoffice-api`, ≥ 2 replica khác
  nhau; 20 request tới 8090: mọi upstream là IP của `directus` (US1 kịch bản 2, SC-003).
- `GET http://localhost:8091/admin/config.json` → `{ "apiUrl": "http://localhost:8091" }`; `GET http://localhost:8090/admin/`
  trả trang có chữ `directus` (US1 kịch bản 1).
- `POST /files/tus` ở 8091 → `Location` bắt đầu bằng `http://localhost:8091/files/tus/`.
- `BACKOFFICE_REPLICAS=3 docker compose up -d --wait`: 3 replica + 1 Directus, không sửa file (US1 kịch bản 4).
- `docker compose -f docker-compose.yml -f docker-compose.standalone.yml config`: không service `directus`,
  `backoffice-api.environment` = `bootstrap.environment` (cùng `.env`), `lb.ports` chỉ `8090:8080` (US1 kịch bản 5).
