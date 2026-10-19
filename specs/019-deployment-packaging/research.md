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
  `org.opencontainers.image.{title,version,revision}` (FR-022; chủ dự án bỏ `source` và `io.backoffice.directus-compat`,
  2026-10-20), cùng nhãn cho FE. Không `HEALTHCHECK` trong image (Directus không có; compose và chart tự khai báo). User `node` của
  `node:22-alpine` là uid/gid 1000, trùng image Directus (`directus/Dockerfile:56` cũng `USER node` trên node alpine) nên
  file trên volume dùng chung không lệch quyền (FR-020).
- **Init chặn zombie (FR-026)**: runtime stage cài `tini` bằng `apk add --no-cache tini` (trước `USER node`),
  `ENTRYPOINT ["/sbin/tini", "--"]`, `CMD ["node", "dist/main.js"]`. Hiện nay `docker-entrypoint.sh` của image Node
  `exec` thẳng `node`, nên Node là PID 1: Node không gọi `wait()` cho tiến trình mồ côi bị gán lại về PID 1, chúng thành
  zombie. `tini` chuyển tín hiệu cho con và thoát với mã của con (bị tín hiệu giết thì 128 + số tín hiệu, tức 143 với
  SIGTERM) [Unverified: T001 (h) kiểm trên image đã build]. Phiên bản: bản `tini` của Alpine 3.24 [Unverified: T001 (h)
  ghi bản].
  - Alternatives: `dumb-init` (cũng có trong Alpine; tương đương, bị loại chỉ vì `tini` là init mà `docker run --init`
    dùng và phổ biến hơn); `docker run --init` / `init: true` của compose (bị loại: Kubernetes không có tùy chọn này, và
    "chỉ đổi image" thì không thêm được); package npm (bị loại: init phải là PID 1 trước Node).
- **Non-root (FR-025)**: BE giữ `USER node` (1000:1000, như Directus); FE chạy 1001:1001 (chủ dự án 2026-10-20): runtime
  stage tạo user `backoffice` 1001:1001 (`addgroup`/`adduser` của busybox), `USER 1001:1001` dạng số để `runAsNonRoot` của
  Kubernetes kiểm được, `chown` cho 1001 thư mục cache nginx và `conf.d` (image unprivileged mặc định cho 101:0); `lb` của compose đổi sang
  `nginxinc/nginx-unprivileged:1.28.0-alpine` (cùng image FE), nghe 8080/8081 trong container, publish ra 8090/8091.
  Chart thêm `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]` (không cần quyền nào: cổng > 1024).
  Không đặt `readOnlyRootFilesystem` (FE ghi `config.json`, `csp.inc` lúc khởi động; không có trong yêu cầu).
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
  `TUS_ENABLED=true`, `CACHE_ENABLED=true`, `CACHE_STORE=redis`, `RATE_LIMITER_STORE=redis`, `SYNCHRONIZATION_STORE=redis`
  (Redis bắt buộc cho đa replica, Nguyên tắc VII). `SYNCHRONIZATION_STORE` không có trong `defaults.ts` của Directus;
  khác `redis` thì `directus/api/src/synchronization.ts:20` dùng bộ nhớ process, nên lock flow theo lịch, job dọn TUS,
  retention chạy riêng trên từng instance (phát hiện ở analyze 2026-10-20; profile `flows-schedule` của parity đã đặt
  biến này). Service Backoffice ghim `platform: linux/amd64` như `tests/parity/docker-compose.yml` (FR-023).
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
    `runAsNonRoot`, uid/gid/fsGroup 1000 (BE), 1001 (FE); `resources` từ values.
  - HPA `autoscaling/v2` CPU `averageUtilization` 70, `minReplicas` 2, `maxReplicas` 10; khi HPA bật, Deployment không đặt
    `replicas`.
  - `uploads.existingClaim` → volume ở `/directus/uploads` (FR-047).
  - `values-separate-domain.yaml` mẫu cho chế độ domain riêng.
  - Kiểm cấu hình đa instance (FR-053), cùng `_checks.tpl` với FR-076, chạy ở mọi chế độ: `lookup` ConfigMap và Secret;
    gộp hai map (Secret qua `b64dec`); lý do lỗi theo đúng quy tắc của Directus: Redis có khi `REDIS_ENABLED` = `true` (nếu
    có biến này), không thì khi có `REDIS` hoặc một khóa bắt đầu bằng `REDIS_`
    (`directus/api/src/redis/utils/redis-config-available.ts`); `CACHE_STORE`, `RATE_LIMITER_STORE` mặc định `memory`
    (`directus/packages/env/src/constants/defaults.ts:32,82`); `SYNCHRONIZATION_STORE` phải đúng `redis`; có `SECRET`
    (`utils/get-secret.ts`: không có thì mỗi process sinh ngẫu nhiên); `DB_CLIENT` khác rỗng và khác `sqlite3`;
    `STORAGE_LOCATIONS` có `local` thì phải có `uploads.existingClaim`. Có lý do nào thì
    `fail` với danh sách lý do và giá trị cần đặt.
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
- `compose.test.ts` (US2, FR-030, FR-051, FR-023): ngoài thứ tự và env, `POST /auth/login` qua `lb` với
  `X-Forwarded-For: 203.0.113.9` một lần rơi vào replica BE, một lần gọi Directus qua cùng `lb` (lặp tới khi
  `$upstream_addr` là Directus): `directus_activity.ip` của hai lần đăng nhập đều `203.0.113.9` (`IP_TRUST_PROXY` mặc
  định của Directus); `docker image inspect` image Backoffice `Architecture=amd64`; `up -d --scale backoffice-api=6`,
  6 replica `pong` và `/users/me` cùng một token, rồi scale về 3.
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
  scale` 2→4→2 dưới tải (cùng đường với HPA đổi replica). Cài metrics-server (manifest chính thức,
  `--kubelet-insecure-tls` cho kind) để kiểm HPA đọc được CPU (cột TARGETS không `<unknown>`); không chờ HPA tự scale
  (phụ thuộc thời gian, dễ chập chờn); kiểm FR-053 bằng một ConfigMap thiếu `SYNCHRONIZATION_STORE`.

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

## Kết quả T001 (2026-10-20)

- (a) `nginxinc/nginx-unprivileged:1.28.0-alpine` (nginx 1.28.0, uid 101): `nginx -t` chấp nhận `upstream { zone ...;
  server backend:80 resolve; }` với `resolver 127.0.0.11 valid=5s` → dùng `resolve` cho `lb` (R5). Kiểm chạy thật với nhiều
  replica ở `compose.test.ts` (4).
- (b) `docker run --entrypoint id` trên `hiennd23/backoffice-api:local` và `directus/directus:11.17.4`: cả hai
  `uid=1000(node) gid=1000(node)`.
- (c) Không kiểm `preStop.sleep` gốc: chart dùng `exec sleep` chạy được trên mọi bản ≥ 1.29, nên kết quả không đổi thiết kế.
- (d) Không kiểm tình trạng ingress-nginx [Unverified]; chart không phụ thuộc controller, CI dùng Traefik.
- (e) Bản ghim (bản ổn định mới nhất phát hành trước 2026-10-06, theo `gh api repos/<repo>/releases`):

  | Công cụ | Bản | Ngày phát hành |
  |---------|-----|----------------|
  | Helm | v4.3.0 | 2026-09-09 (v4.3.1, v3.22.1 ngày 2026-10-15: quá mới) |
  | kind | v0.33.0 | 2026-08-26 |
  | kubeconform | v0.8.0 | 2026-06-04 |
  | chart Traefik | v41.6.1 | 2026-09-30 (v41.7.x, v42.0.0: quá mới) |
  | metrics-server | v0.9.0 | 2026-07-13 |
  | `azure/setup-helm` | v5.0.1 | 2026-06-23 |
  | `helm/kind-action` | v1.15.0 | 2026-09-02 (v1.15.1 ngày 2026-10-06: quá mới) |
  | `@nx-tools/nx-container` | 7.3.0 | 2026-06-26 (R13) |

- (f) Header Directus 11.17.4 thật (Directus của env benchmark, `PUBLIC_URL=http://localhost:8155`, không có biến
  `CONTENT_SECURITY_POLICY_*`):
  - `GET /admin`: `Content-Security-Policy: script-src 'self' 'unsafe-eval';worker-src 'self' blob:;child-src 'self'
    blob:;img-src 'self' data: blob: https://raw.githubusercontent.com https://avatars.githubusercontent.com;media-src
    'self';connect-src 'self' https://* wss://*;default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action
    'self';frame-ancestors 'self';object-src 'none';script-src-attr 'none';style-src 'self' https: 'unsafe-inline'`
    (directive của Directus trước, rồi mặc định helmet chưa bị ghi đè; không có `upgrade-insecure-requests`; ngăn cách
    `;` không khoảng trắng), `Cache-Control: no-cache`, `Vary: Origin, Cache-Control`.
  - Asset `./assets/*.js`: `Cache-Control: max-age=31536000, immutable`, `Vary: Origin, Cache-Control`, cùng CSP.
  - `/admin` (không `/`), `/admin/content/abc`, `/admin/missing.js`: `200 text/html` (index).
- (g) `dev/directus-reference`: `postgis/postgis:16-3.4-alpine`, `redis:7-alpine`, `cgr.dev/chainguard/minio:latest`.
- (h) Alpine 3.24.2 có `tini` 0.19.0 (`apk add --no-cache tini`); `tini -- node ...`: PID 1 là `tini`, tiến trình `sleep`
  mồ côi được dọn (không còn `Z`), `docker stop` → mã thoát 143.

## R13. Build image bằng `@nx-tools/nx-container` (chủ dự án, 2026-10-20)

- **Decision**: build hai image qua Nx: target `container` (executor `@nx-tools/nx-container:build`, engine `docker`
  = `docker buildx build`) khai báo trong `apps/api/project.json` và `apps/web/project.json` (không bật plugin suy ra task
  trong `nx.json`, để chỉ hai project này có target). Options: `context: "."`, `file`, `platforms: ["linux/amd64"]`,
  `load: true`, `tags: ["hiennd23/backoffice-<app>:local"]`, `build-args` mặc định. CI ghi đè bằng biến
  `INPUT_API_TAGS`, `INPUT_API_BUILD_ARGS`, `INPUT_WEB_TAGS`, `INPUT_WEB_BUILD_ARGS` (quy tắc
  `@nx-tools/core` `getInput`: `INPUT_<PROJECT>_<NAME>` rồi `INPUT_<NAME>`; danh sách trong env thay hẳn danh sách của
  options). Target `cache: false`.
- **Kiểm**: 7.3.0 có peer `nx >=18 <24`, `@nx/devkit`, `@nx/js` (repo Nx 23.3.0), MIT, không advisory trên GitHub; thêm
  catalog `'@nx-tools/nx-container': 7.3.0` và devDependency root; lockfile thêm `@nx-tools/{core,ci-context,
  container-metadata}` và `@actions/*`, `@octokit/*` (devDependency, không vào image).
- **Lưu ý**: executor nạp `dotenv/config` (đọc `.env` ở thư mục chạy, tức gốc repo nếu có). Không dùng `metadata` (tag
  tự sinh từ CI) vì CI đã tự đặt `ci`, `latest`, SHA.
- **Phạm vi**: thay mọi lệnh `docker build` của 019 (quickstart, T023, T032, job `docker` của CI ở T110). `build:` trong
  `tests/parity/docker-compose.yml` (env parity của các feature trước) giữ nguyên.

## Kết quả T022, T023, T030 (2026-10-20)

- CSP của Directus 11.17.4 đo trên 4 container (SQLite): ghi đè danh sách gộp theo vị trí (lodash `merge`;
  `IMG_SRC=array:'self',data:` không đổi gì), giá trị có dấu phẩy không cần `array:` cũng là danh sách, directive mới
  thêm sau `connect-src`, `USE_DEFAULTS=false` chỉ còn directive của Directus + env; `FRAME_ANCESTORS=false` làm Directus
  không khởi động (PM2 "0 application online"). `csp.awk` chạy bằng awk của busybox trong image nginx cho đúng từng ký
  tự ở cả 4 bộ env; `web-image.test.ts` so lại mỗi lần chạy.
- Hệ quả: FE gửi CSP ở cả ba cấu hình E2E của 012 (trước 019 nginx không gửi). Cấu hình `cors` (FE `localhost:8181`, API
  `http://127.0.0.1:8163`) cần origin API trong `connect-src`, `img-src`, `media-src`: thêm env vào `backoffice-web-cors`
  của `tests/parity/docker-compose.yml`. Không chạy E2E local ở T023 (env benchmark của phiên 018 đang giữ các cổng
  8155/8156 của env parity); job `e2e-web` của CI kiểm trên image mới.
- Không có `tini`, Node làm PID 1 để lại tiến trình `sleep` mồ côi ở trạng thái `Z` (ppid 1); có `tini` thì không: test
  zombie của `image-swap.test.ts` bắt được lỗi thật.
- DB chưa bootstrap: BE thoát mã khác 0 với `database doesn't have directus tables installed` (001).
- Lần chạy sạch `parity-tests:deploy` (env mới, 3 replica, teardown): 20/20 test, 55 s khi image đã có.

## Kết quả CI lượt 1 (run 39310045859, `d49a853`) và bản sửa

- `db-unchanged.test.ts`: `compose('wait', 'backoffice-api')` sau SIGTERM báo "no containers". Trước 019 Node là PID 1:
  lần tự gửi lại SIGTERM ở cuối terminus bị kernel bỏ qua với PID 1, nên container thoát chậm (khi event loop rảnh, mã 0).
  Có `tini`, container thoát ngay với mã 143, trước khi `compose wait` tìm container đang chạy. Sửa harness: lấy id rồi
  `docker wait <id>` (trả mã cả khi container đã dừng).
- `history/retention.test.ts` (4 ca đỏ, cả "chỉ Directus chạy"): Directus của cặp retention bị dừng lúc 19:31:00.570,
  ngay sau tick `*/10` giây. App bị dừng khi đang giữ khóa `schedule--data-retention` để lại khóa 10 phút (timeout của
  Directus, `schedules/retention.ts:22`), app kia bỏ qua mọi tick. [Inference] Race theo thời điểm dừng so với tick, không
  phải hành vi mới; thời gian khởi động image đổi nên thời điểm dừng đổi. Sửa harness: xóa khóa sau mỗi lần dừng và trước
  ca "both run".
- E2E web: FE gửi CSP ở cả ba cấu hình. `content-live-preview.spec.ts` (iframe `https://preview.example`),
  `sso.spec.ts` (cặp 8955/8956), `password-invite.spec.ts` (cặp setup 10456) bị CSP chặn (fixture cấm lỗi console). Env
  parity của hai container web thêm `CONNECT_SRC` có `http://127.0.0.1:*`, `IMG_SRC`/`MEDIA_SRC` (cors), `FRAME_SRC`
  `https://preview.example` (như người vận hành Directus cấu hình live preview). Chạy lại ở máy: cors 18/18, proxy-api
  7/7, proxy-directus 7/7, không còn vi phạm CSP. Lượt cors đầy đủ ở máy: 200 đạt, 13 đỏ, tất cả do CSP trên.
- `files-image-editor.spec.ts:133` (proxy-api, cùng run): helper `pixels()` của test gọi `fetch('data:...')` trong trang,
  bị `connect-src` (không có `data:`) chặn. Sửa helper: giải mã PNG thành `Blob` bằng `atob`. Chạy lại ở máy: 4/4.
