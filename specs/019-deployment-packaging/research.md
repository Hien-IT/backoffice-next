# Research: Đóng gói triển khai (019)

Khảo sát 2026-10-20. Đường dẫn `directus/...` là bản Directus 11.17.4 chỉ đọc trong repo. Phiên bản công cụ ngoài repo
(Helm, kind, kubeconform, Traefik, nginx) ghi "[Unverified]" khi chưa kiểm trên trang phát hành; T001 kiểm và ghim.

## R1. Vị trí file và cách tổ chức

- **Decision**: thư mục mới `deploy/` ở gốc repo: `deploy/compose/` (compose dev và test chấp nhận), `deploy/helm/backoffice/`
  (chart), `deploy/README.md` (tài liệu vận hành). Test chấp nhận ở `tests/parity/src/deploy/` với config Vitest riêng
  `tests/parity/vitest.deploy.config.ts` và target Nx `parity-tests:deploy`.
- **Rationale**: `dev/directus-reference` và `tests/parity/docker-compose.yml` đang được các phiên khác và CI dùng; không
  sửa chúng. `tests/parity` đã có helper đăng nhập, Redis, compose, request TUS thô, `autocannon` trong catalog.
- **Alternatives**: thêm profile vào `tests/parity/docker-compose.yml` (bị loại: file 1.400 dòng, global-setup của parity
  dựng cặp Directus/Backoffice theo vendor, không hợp với N replica); project Nx mới `tests/deploy` (bị loại: chép lại
  helper).

## R2. Image FE: `/admin`, cache, CSP

- **Decision**:
  - `nginx.conf`: `location = /admin` trả `index.html` (Directus `app.get('/admin', sendHtml)`, không redirect);
    `location /admin/` `try_files $uri /admin/index.html` (Directus `app.use('/admin/*', sendHtml)` sau static, kể cả path
    có đuôi file); `index.html` `Cache-Control: no-cache`, file khác `max-age=31536000, immutable`, cả hai
    `Vary: Origin, Cache-Control` (`directus/api/src/app.ts:277-290`); `config.json` giữ `no-store` (012).
  - CSP: `40-config.sh` sinh thêm `/etc/nginx/conf.d/csp.inc` (`add_header Content-Security-Policy "..." always;`) lúc
    khởi động. Thuật toán: bộ directive mặc định của helmet (`useDefaults: true`) gộp các directive của Directus
    (`app.ts:166-195`), rồi áp `CONTENT_SECURITY_POLICY_DIRECTIVES__<NAME>` (tên `SCREAMING_SNAKE` → `kebab-case`; giá trị
    bỏ tiền tố `array:`, dấu phẩy thành khoảng trắng; `false` hoặc rỗng thì bỏ directive) và
    `CONTENT_SECURITY_POLICY_USE_DEFAULTS=false` (chỉ còn directive của Directus và env). Viết bằng `sh` + `awk` (image
    nginx không có Node).
  - Thứ tự directive và chuỗi mặc định lấy từ header thật của Directus 11.17.4 (`curl -I /admin` trên compose), ghi vào
    test; test so header FE với header Directus ở cùng env, gồm 3 bộ env ghi đè (R9).
  - Probe FE: `GET /admin/config.json` (không phụ thuộc BE, chứng minh `40-config.sh` đã chạy).
- **Rationale**: FR-001, FR-003..FR-006; giống Directus đến từng header để D-120 chỉ còn "ai phục vụ".
- **Alternatives**: module njs (bị loại: thêm module, khó test hơn sh); CSP cố định lúc build (bị loại: không theo env,
  trái Nguyên tắc VIII); trả `404` cho asset thiếu (bị loại: khác Directus).

## R3. Image BE

- **Decision**: giữ `apps/api/Dockerfile`; thêm `ARG BACKOFFICE_VERSION`, `ARG VCS_REF` và nhãn OCI
  `org.opencontainers.image.{title,version,revision,source}` cộng `io.backoffice.directus-compat=11.17.4` (FR-022), cùng
  nhãn cho FE. Không `HEALTHCHECK` trong image (Directus không có; compose và chart tự khai báo). User `node` của
  `node:22-alpine` là uid/gid 1000, trùng image Directus (`directus/Dockerfile:56` cũng `USER node` trên node alpine) nên
  file trên volume dùng chung không lệch quyền (FR-020).
- **Rationale**: image đã đạt FR-020/021 từ 001 (`WORKDIR /directus`, cổng 8055, một process, không bootstrap).
- **Alternatives**: `HEALTHCHECK` trong image (bị loại: Kubernetes bỏ qua, compose tự khai báo được, khác Directus).

## R4. Tắt máy không lỗi request (FR-033..FR-035)

- **Vấn đề**: terminus (001, như Directus) đóng listener ngay khi nhận tín hiệu. Kubernetes gỡ endpoint song song với
  SIGTERM, nên ingress còn gửi request tới pod trong vài giây → lỗi kết nối. ingress-nginx và Traefik giữ keepalive tới
  upstream.
- **Decision**:
  - Kubernetes: `lifecycle.preStop.exec: ["sleep", "<shutdownDelaySeconds>"]` (mặc định 10; image node alpine có
    `sleep` của busybox). Pod vẫn phục vụ trong lúc endpoint được gỡ; sau `preStop` kubelet mới gửi SIGTERM; terminus chạy
    như 001. `terminationGracePeriodSeconds` mặc định 30 ≥ 10 + `SERVER_SHUTDOWN_TIMEOUT` (1 s mặc định) + đóng kết nối;
    tài liệu ghi công thức. Không dùng `preStop.sleep` gốc của Kubernetes vì cần ≥ 1.30 [Unverified: kiểm ở T001], bản tối
    thiểu là 1.29.
  - Compose: load balancer nginx không bật `keepalive` tới upstream (mỗi request một kết nối), `proxy_next_upstream error
    timeout` (mặc định): replica đã đóng listener trả "connection refused" trước khi request được gửi, nginx chuyển sang
    server khác, kể cả POST. `stop_grace_period: 30s`.
  - Instance Directus trong pool (Q1: A): Directus cũng đóng listener ngay; tài liệu hướng dẫn thêm cùng `preStop` vào
    Deployment Directus (cấu hình pod, không phải env). Compose không cần (retry ở trên).
- **Rủi ro còn lại**: kết nối đã được kernel nhận vào backlog đúng lúc listener đóng có thể bị RST sau khi nginx đã gửi
  request; nginx không gửi lại request không idempotent → `502`. Cửa sổ rất ngắn; SC-002 đo trên 5.000+ request. Nếu test
  thấy lỗi: thêm `entrypoint` bọc `sh -c 'trap ...; sleep N'` trong compose (vẫn là cấu hình triển khai, không đổi code).
- **Alternatives**: sleep trong `beforeShutdown` của terminus với biến `BACKOFFICE_SHUTDOWN_DELAY` (bị loại: spec FR-033
  giữ nguyên trình tự 001 và không thêm biến); `proxy_next_upstream non_idempotent` (bị loại: có thể ghi trùng).

## R5. Load balancer của compose và truy cập từng instance

- **Decision**: một service `lb` (`nginx:1.28-alpine`, cùng dòng với FE) nghe cổng 8090 (chế độ chung domain) và thêm 8091
  ở chế độ domain riêng. Upstream pool:
  `upstream api_pool { zone api_pool 64k; server directus:8055; server backoffice-api:8055 resolve; }` với
  `resolver 127.0.0.11 valid=5s`: DNS Docker trả mọi replica của service, `resolve` cập nhật khi scale.
  [Unverified: tham số `resolve` của upstream có trong nginx bản mã nguồn mở từ 1.27.3; T001 chạy `nginx -t` trên image
  đã ghim để xác nhận. Nếu không có: upstream liệt kê `backoffice-api-1..N` qua template sinh lúc khởi động.]
- Test gọi thẳng từng instance: mỗi replica publish cổng 8055 ra cổng ngẫu nhiên (`ports: ["8055"]`), test đọc bằng
  `docker compose port --index <i> backoffice-api 8055`; Directus cổng cố định 8095.
- **Rationale**: FR-035, FR-043, FR-044; nginx đã dùng ở FE và proxy parity, không thêm phần mềm mới.
- **Alternatives**: Traefik theo nhãn Docker (bị loại: phần mềm mới cho dev); HAProxy (bị loại: như trên).

## R6. Thứ tự khởi động compose

- **Decision**: `postgres` (postgis/postgis như `dev/directus-reference`), `redis:7-alpine`, `minio` (Chainguard như
  parity) healthy → `minio-init` tạo bucket rồi thoát → `directus` (`directus/directus:11.17.4`, chạy bootstrap và tạo
  admin, healthcheck `/server/health`) → `backoffice-api` (`deploy.replicas: ${BACKOFFICE_REPLICAS:-2}`) và
  `backoffice-web` → `lb`. Một file `.env` (sinh bằng `deploy/compose/init-env.sh` từ `.env.example`, secret ngẫu nhiên
  bằng `openssl rand`), `env_file: .env` cho cả `directus` và `backoffice-api` (FR-041). Storage `s3` trỏ MinIO,
  `TUS_ENABLED=true`, `CACHE_ENABLED=true`, `CACHE_STORE=redis`, `RATE_LIMITER_STORE=redis` (Redis bắt buộc cho đa
  replica, Nguyên tắc VII).
- **Rationale**: FR-040..FR-043; BE không chạy migration (Nguyên tắc II) nên Directus phải khởi tạo DB trước.

## R7. Helm chart

- **Decision** (`deploy/helm/backoffice`, `apiVersion: v2`, `appVersion` = phiên bản Backoffice):
  - `templates/`: `api-deployment.yaml`, `api-service.yaml`, `api-hpa.yaml`, `web-deployment.yaml`, `web-service.yaml`,
    `ingress.yaml`, `_helpers.tpl`, `NOTES.txt`. Không PDB, ServiceAccount, NetworkPolicy (không có trong yêu cầu).
  - Env: `envFrom` `configMapRef` + `secretRef` theo `directus.configMap`, `directus.secret` (bắt buộc, `required`). FE
    chỉ `configMapRef`. Chế độ domain riêng: `domain.publicUrl` → `env: PUBLIC_URL` (`env` thắng `envFrom`). Không có map
    env tự do, nên chart không nhận biến nào khác (FR-071).
  - Kiểm cookie domain (FR-076): `templates/_checks.tpl` khi `domain.publicUrl` khác rỗng: `lookup "v1" "ConfigMap"` và
    `lookup "v1" "Secret"` (giá trị qua `b64dec`) theo `directus.*`; với mỗi biến `REFRESH_TOKEN_COOKIE_DOMAIN`,
    `SESSION_COOKIE_DOMAIN` có giá trị `v`: `d = trimPrefix "." v`; nếu `ingress.host` ≠ `d` và không `hasSuffix (printf
    ".%s" d)` thì `fail` với thông báo FR-076. `lookup` trả rỗng khi `helm template` hoặc `--dry-run=client`, nên kiểm chỉ
    chạy khi cài thật; tài liệu ghi lệnh `kubectl get cm,secret ... | grep COOKIE_DOMAIN` cho nơi chỉ dùng manifest.
  - Pool: pod BE có nhãn `backoffice.io/api-pool: <apiPool.name>` (mặc định tên release); Service `<release>-api` chỉ
    chọn nhãn này. Directus vào pool bằng cách thêm đúng nhãn vào pod template của nó (Q1: A, FR-050).
  - Probe: `startupProbe` `/server/ping` (period 2 s, 30 lần), `readinessProbe` `/server/health` (period 5 s, 2 lần),
    `livenessProbe` `/server/ping` (period 10 s, 3 lần) (FR-031, FR-032). FE: `/admin/config.json`.
  - `strategy.rollingUpdate: maxSurge 1, maxUnavailable 0`; `preStop` và grace period theo R4; `securityContext`
    `runAsNonRoot`, uid 1000 (BE), 101 (FE); `resources` từ values.
  - HPA `autoscaling/v2` CPU `averageUtilization` 70, `minReplicas` 2, `maxReplicas` 10; khi HPA bật, Deployment không đặt
    `replicas`.
  - `uploads.existingClaim` → volume ở `/directus/uploads` (FR-047).
  - `values-separate-domain.yaml` mẫu cho chế độ domain riêng.
- **Rationale**: FR-045..FR-049, FR-070..FR-072; `helm template` cho ra manifest thường.
- **Alternatives**: Kustomize (bị loại: người yêu cầu nêu Helm hoặc manifest; Helm có `required` và điều kiện cho hai chế
  độ); chart con cho Postgres/Redis (bị loại: môi trường thật đã có, chart chỉ đóng gói app).

## R8. Ingress và controller

- **Decision**: một tài nguyên `networking.k8s.io/v1` Ingress: `ingress.host`, `ingress.className`, `ingress.tls`,
  `ingress.annotations`; path `/admin` (Prefix) → Service web; `/` (Prefix) → Service api pool; `ingress.extraPaths`
  (path → service, port) cho SAML về Directus (FR-052). Annotation mặc định rỗng; `deploy/README.md` có bộ annotation
  cho ingress-nginx (`proxy-body-size: "0"`, `proxy-request-buffering: "off"`, `proxy-read-timeout`) và Traefik (FR-051).
  CI dùng Traefik cài bằng chart chính thức.
- [Unverified] Dự án ingress-nginx được thông báo ngừng phát triển (cuối 2025); T001 kiểm lại trước khi chọn controller
  cho CI. Chart không phụ thuộc controller.
- **Alternatives**: Gateway API `HTTPRoute` (bị loại: người yêu cầu nêu Ingress; có thể thêm sau).

## R9. Test chấp nhận (`tests/parity/src/deploy/`)

- Môi trường: `global-setup.ts` riêng chạy `docker compose -p bo-deploy -f deploy/compose/docker-compose.yml up -d --wait`
  với `BACKOFFICE_REPLICAS=3` (chung domain) và lượt thứ hai với `docker-compose.separate-domain.yml`; image `:ci` của job
  `docker` (`PARITY_NO_BUILD` như e2e-web).
- `sessions.test.ts` (US3): đăng nhập `mode: json`, `cookie`, `session` ở instance 1; `/users/me`, `/items` trên 4
  instance; refresh ở instance khác; logout ở instance thứ ba rồi token cũ `401` ở cả 4; đăng nhập sai luân phiên tới khi
  khóa (`AUTH_LOGIN_ATTEMPTS` nhỏ trong `.env` của test).
- `schema.test.ts` (US4): `POST /collections` + `POST /fields` ở A, đọc ngay ở B, C, D; sửa permission ở Directus, kiểm ở
  BE; sửa item với `CACHE_ENABLED`, đọc ở instance khác không ra bản cũ.
- `flows-schedule.test.ts` (US5): flow `schedule` cron `*/2 * * * * *` (giây, như `tests/parity/src/flows/schedule.test.ts`)
  với operation `log`; đếm dòng `directus_activity`/revisions của flow qua ≥ 10 lượt; mỗi lượt đúng 1; tắt instance đang
  giữ lượt rồi kiểm lượt kế tiếp vẫn chạy.
- `tus.test.ts` (US5, FR-061): tách hàm `tus()` của `files/tus.test.ts` sang `src/tus-request.ts` (dùng chung); file
  ≥ 4 × `TUS_CHUNK_SIZE` (đặt `TUS_CHUNK_SIZE` nhỏ trong `.env` test); chunk k tới instance k mod 4; so SHA-256 với object
  trên MinIO; đếm `directus_files`; tắt instance giữa chừng, `HEAD` lấy offset ở instance khác, gửi tiếp.
- `shutdown.test.ts` (US6, FR-064): `autocannon` qua `lb` (GET `/items`, POST rồi DELETE item) trong 60 s; giây 15
  `docker kill -s TERM` một replica BE; giây 35 `docker compose up -d --scale backoffice-api=3`; kiểm
  `errors + non2xx = 0`, mã thoát 143, thời gian từ TERM tới thoát ≤ grace; kết nối DB (`pg_stat_activity` theo
  `client_addr` của container) và Redis (`CLIENT LIST` theo `addr`) của replica đó về 0.
- `image-swap.test.ts` (US1): `docker compose run` image BE với đúng service definition của `directus` (cùng env, volume),
  kiểm health, đăng nhập, upload; `docker inspect` so env và mount giữa hai container.
- `web-image.test.ts` (US8): hai container FE cùng image, khác `PUBLIC_URL`; `config.json`; deep link `/admin/content/x`
  trả `index.html`; header cache; CSP FE = CSP Directus `/admin` ở 3 bộ env (mặc định, ghi đè `SCRIPT_SRC`, tắt
  `USE_DEFAULTS`).
- `separate-domain.test.ts` (US9, FR-075): `Location` TUS ở cổng 8091; link mời trong DB theo domain B; sửa ở Directus
  (8090) thấy ngay ở 8091; `Set-Cookie` không có `Domain`; không request nào của FE tới 8090 (kiểm `config.json` và log
  `lb`).
- Kubernetes (FR-049, SC-003): job CI tạo cụm kind, nạp image, cài Traefik, Postgres/Redis/MinIO/Directus từ
  `deploy/helm/backoffice/ci/deps.yaml` (chỉ cho CI), ConfigMap/Secret kiểu Directus, cài chart; kiểm probe Ready, Ingress
  định tuyến `/admin` và `/server/ping`; `kubectl rollout restart` BE dưới `autocannon` qua Ingress → 0 lỗi; `kubectl
  scale` thay cho HPA (cụm kind không có metrics-server; HPA chỉ kiểm được tạo đúng).

## R10. Chế độ domain riêng (US9)

- **Decision**: compose override `docker-compose.separate-domain.yml`: `lb` dùng `lb/separate-domain.conf` (8090 → chỉ
  Directus, kể cả `/admin` của Directus; 8091 → `/admin` FE, còn lại pool chỉ BE); `backoffice-api` và `backoffice-web`
  thêm `environment: PUBLIC_URL: http://localhost:8091`; `.env` không đổi (`PUBLIC_URL=http://localhost:8090` của Directus).
  Chart: `values-separate-domain.yaml` (`domain.publicUrl`, host riêng, Directus không gắn nhãn pool).
- Các chỗ Directus dùng `PUBLIC_URL` (khảo sát): `services/tus/server.ts:135` (`Location`), `services/users.ts:161,514,589`
  (link mời, xác minh, đặt lại mật khẩu), `services/shares.ts:164`, `auth/utils/generate-callback-url.ts` (callback SSO,
  có `AUTH_ALLOWED_PUBLIC_URLS`), `utils/should-skip-cache.ts` (Referer từ `/admin`), `app.ts` (`<base href>` của app).
  Vì vậy `PUBLIC_URL` phải đặt riêng (FR-071).
- Khóa response cache (`utils/get-cache-key.ts`) không có host: `/server/specs/oas` (`generate(req.headers.host)`) có thể
  trả URL của domain kia khi đã cache; giống hai Directus khác domain, chỉ ghi tài liệu.
- Trên `localhost`, cookie không tách theo cổng; dev ở hai cổng dùng chung cookie (vô hại: cùng `SECRET`). Test kiểm
  `Set-Cookie` không có `Domain` thay vì kiểm hành vi trình duyệt.

## R11. CI

- **Decision**: trong `ci.yml` thêm job `deploy` (needs `docker`): nạp image, chạy `parity-tests:deploy` (chung domain,
  rồi domain riêng); job `deploy-k8s` (needs `docker`): `helm lint`, `helm template | kubeconform -strict`, kind (R9).
  Thêm cả hai vào `needs` của `publish`. Chạy mọi push lên `main` (FR-065).
- Ước lượng thời gian: `deploy` ~15 phút, `deploy-k8s` ~15 phút [Inference: theo thời gian dựng env parity hiện tại, chưa
  đo].

## R12. Phiên bản công cụ (ghim ở T001)

| Công cụ | Dùng ở | Ghi chú |
|---------|--------|---------|
| nginx 1.28 alpine | `lb` compose | cùng dòng FE `nginx-unprivileged:1.28.0-alpine`; xác nhận `resolve` (R5) |
| Helm 3.x hoặc 4.x | lint, template, cài | [Unverified] bản mới nhất; chart `apiVersion: v2` chạy trên cả hai |
| kind, kubeconform, Traefik chart | job `deploy-k8s` | [Unverified] ghim bản mới nhất có ≥ 14 ngày |
| `azure/setup-helm`, `helm/kind-action` | GitHub Actions | [Unverified] ghim theo SHA hoặc tag như các action hiện có |
