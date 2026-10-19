---

description: "Danh sách task cho feature 019: đóng gói triển khai (image FE/BE, compose dev, Helm chart, test đa replica)"
---

# Tasks: Đóng gói triển khai (image FE và BE, nhiều replica sau load balancer, docker-compose dev, Helm chart)

**Input**: Tài liệu thiết kế trong `/specs/019-deployment-packaging/`
**Prerequisites**: `plan.md`, `spec.md`. Dùng thêm `research.md` (R1–R12), `data-model.md`, `contracts/` (`images.md`,
`compose.md`, `helm-values.md`, `tests.md`), `quickstart.md`, `checklists/requirements.md`.

**Điều kiện bắt đầu**: làm trên `main`; checkout dùng chung với phiên 018: `git add` theo đường dẫn, không `git add -A`,
không `stash`, `reset`, `checkout -- <file>`; phiên 018 là người push duy nhất: sau mỗi lượt, gửi hash commit và danh
sách path cho 018, 018 push và gửi lại id run CI (thỏa thuận 2026-10-20). Không chạy benchmark (`benchmark.yml`) khi
018 còn run đang chạy. Không đụng `dev/directus-reference/`, `tests/parity/docker-compose.yml` (đang dùng cho CI và
các phiên khác, R1); `deploy/compose` dùng project name riêng `bo-deploy` và cổng 8090–8095 để không đụng env parity
(8155/8156) và `dev/directus-reference` (8055). Không sửa file dưới `directus/`.

**Tests**: BẮT BUỘC (Nguyên tắc V, VI).
- Feature không thêm hay sửa endpoint API; không có test đối chiếu endpoint mới. Đối chiếu ở mức triển khai: header và
  CSP của FE so trực tiếp với Directus (`web-image.test.ts`), các test đa instance chạy trên cả 3 replica BE lẫn
  Directus (`contracts/tests.md`).
- Mọi file cấu hình có test chạy nó: compose qua `parity-tests:deploy`, chart qua `helm lint` + `kubeconform` + cụm kind,
  `40-config.sh` qua `web-image.test.ts`.
- Test viết trước, chạy đỏ (hoặc "không chạy được vì chưa có file"), rồi mới sửa cấu hình.

**Organization**: Task nhóm theo user story của spec, xếp theo bốn lượt commit: **Lượt 1** = Phase 1, 2, 3 (US8 image
FE), 4 (US1 image BE); **Lượt 2** = Phase 5 (US2 compose), 6 (US3+US4), 7 (US5), 8 (US6); **Lượt 3** = Phase 9 (US9
domain riêng), 10 (US7 chart); **Lượt 4** = Phase 11 (CI, tài liệu, Polish). Mỗi lượt kết thúc bằng task "đóng lượt"
(lint, typecheck, test liên quan xanh, commit, gửi hash cho 018, CI xanh, `graphify update .`).

## Quy ước

- Định dạng: `- [ ] T### [P?] [US?] Mô tả kèm đường dẫn file`.
- **[P]**: làm song song được (khác file, không phụ thuộc task chưa xong). **[US#]**: user story của task.
- Gốc đường dẫn: `tests/parity/src/deploy/` viết tắt `deploy-tests/`; `deploy/compose/` viết tắt `compose/`;
  `deploy/helm/backoffice/` viết tắt `chart/`; đường dẫn Directus tính từ `directus/api/src/` trừ khi ghi khác.
- Không thêm biến môi trường mới (Nguyên tắc VIII). Ngoại lệ duy nhất: chế độ domain riêng đặt riêng `PUBLIC_URL`
  (FR-071, Complexity Tracking). `REFRESH_TOKEN_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN` không bao giờ ghi đè: chỉ kiểm và
  báo để chủ dự án sửa env Directus (FR-076).
- Không sửa `apps/api/src/**` (trình tự tắt máy của 001 giữ nguyên; khoảng trễ nằm ở `preStop` và retry của nginx,
  R4, D-122). Nếu một test chỉ qua được khi sửa code API thì dừng và hỏi chủ dự án.
- Phiên bản công cụ ngoài repo (Helm, kind, kubeconform, Traefik, action GitHub) ghim ở T001 sau khi kiểm trang phát
  hành; ghi bản đã ghim vào `research.md` mục "Kết quả T001". Không ghi phiên bản chưa kiểm vào file cấu hình.
- Mọi test đa instance in số liệu đo (số request, lỗi, thời gian) ra log để SC-001..SC-010 đối chiếu được.
- Hình ảnh sinh ra khi test (`:local`, `:ci`) không đẩy đi đâu; `publish` của CI giữ nguyên cách đẩy.

## Phase 1: Setup (kiểm giả định, ghim công cụ, khung test)

**Purpose**: kiểm các điểm "[Unverified]" của research, ghim phiên bản công cụ, dựng khung chạy test deploy để các phase
sau chỉ thêm file test.

- [ ] T001 Kiểm và ghi "Kết quả T001" vào `specs/019-deployment-packaging/research.md`: (a) `docker run --rm
      nginx:1.28-alpine nginx -V` và `nginx -t` với một upstream có `server backoffice-api:8055 resolve;` + `resolver
      127.0.0.11` (R5) — có hỗ trợ thì dùng, không thì chuyển sang template liệt kê `backoffice-api-1..N`; (b)
      `docker run --rm hiennd23/backoffice-api:local id` và cùng lệnh trên `directus/directus:11.17.4` cho ra cùng
      uid/gid 1000 (R3); (c) `preStop.sleep` gốc cần Kubernetes ≥ 1.30 hay không (R4) — kết luận giữ `exec sleep`;
      (d) tình trạng ingress-nginx và chọn controller cho CI (R8; mặc định Traefik); (e) ghim bản Helm, kind,
      kubeconform, chart Traefik, action `azure/setup-helm`, `helm/kind-action` (R12) kèm ngày phát hành ≥ 14 ngày; (f)
      `curl -sI http://localhost:8055/admin` trên `dev/directus-reference` (đã chạy) lấy chuỗi CSP, `Cache-Control`,
      `Vary` mặc định của Directus và ghi nguyên văn (mốc cho T020); (g) ảnh `postgis/postgis` và Redis đang dùng ở
      `dev/directus-reference/docker-compose.yml` để compose 019 dùng cùng bản.
- [ ] T002 [P] Thêm target Nx `deploy` vào `tests/parity/project.json` (`PARITY_SUITE=deploy node scripts/parity.mjs`
      hoặc lệnh `vitest run -c vitest.deploy.config.ts`, cùng kiểu với `parity-blackbox`), file
      `tests/parity/vitest.deploy.config.ts` (`include: ['src/deploy/**/*.test.ts']`, `globalSetup:
      ['src/deploy/global-setup.ts']`, `fileParallelism: false`, `testTimeout: 120_000`, `hookTimeout: 600_000`) và
      kiểm `pnpm nx run parity-tests:deploy` chạy được với 0 test (global-setup tạm là no-op).
- [ ] T003 [P] Tách hàm `tus()` và `b64()`/`metadata()` của `tests/parity/src/files/tus.test.ts` sang
      `tests/parity/src/tus-request.ts` (export), `files/tus.test.ts` import lại; chạy
      `pnpm nx run parity-tests:parity -- --testPathPattern files/tus` (hoặc lệnh tương đương của `scripts/parity.mjs`)
      xanh trên env parity nếu env đang lên, nếu không thì chỉ `typecheck`.
- [ ] T004 [P] Viết `deploy-tests/instances.ts`: `composeProject = 'bo-deploy'`, `composeDir =
      <repo>/deploy/compose`, `compose(...args)` (execFileSync `docker compose -p bo-deploy -f docker-compose.yml [-f
      docker-compose.separate-domain.yml khi DEPLOY_MODE=separate-domain]`), `replicaUrls()` qua `docker compose port
      --index i backoffice-api 8055` cho i = 1..`BACKOFFICE_REPLICAS`, `directusUrl = http://127.0.0.1:8095`, `lbUrl =
      http://127.0.0.1:8090`, `boLbUrl = http://127.0.0.1:8091` (domain riêng), `containerId(service, index)`,
      `login(url, mode)` dùng helper sẵn có của `tests/parity/src/auth-helpers` nếu phù hợp; test
      `deploy-tests/instances.test.ts` chỉ kiểm hàm dựng lệnh (không gọi Docker).

**Checkpoint**: `pnpm nx run parity-tests:deploy` chạy, 0 test; research có "Kết quả T001".

## Phase 2: Foundational (compose tối thiểu và global-setup)

**Purpose**: có một môi trường compose chạy được (chung domain, N replica) để mọi test của các story dùng. Chặn Phase 3
trở đi về mặt test; nội dung compose hoàn thiện ở Phase 5.

- [ ] T010 Viết `compose/.env.example` theo `contracts/compose.md` mục Env (secret để rỗng, `PUBLIC_URL=http://localhost:8090`,
      pg, Redis, `CACHE_STORE=redis`, `RATE_LIMITER_STORE=redis`, `STORAGE_LOCATIONS=s3` + `STORAGE_S3_*` MinIO,
      `TUS_ENABLED=true`, `WEBSOCKETS_ENABLED=false`) và `compose/init-env.sh` (POSIX sh: sao `.env.example` → `.env`
      nếu chưa có, điền `SECRET`, `DB_PASSWORD`, `ADMIN_PASSWORD`, `STORAGE_S3_KEY/SECRET` bằng `openssl rand -hex`,
      `chmod 600`; tùy chọn `--out <file>` cho test); thêm `deploy/compose/.env` vào `.gitignore`.
- [ ] T011 Viết `compose/docker-compose.yml` phần hạ tầng và app theo `contracts/compose.md`: `postgres`, `redis`,
      `minio`, `minio-init` (bản ảnh như T001 (g) và parity), `directus` (cổng 8095, healthcheck `/server/health`,
      `depends_on` healthy, `env_file: .env`, `stop_grace_period: 30s`), `backoffice-api` (`image:
      hiennd23/backoffice-api:${BACKOFFICE_TAG:-latest}`, `deploy.replicas: ${BACKOFFICE_REPLICAS:-2}`, `ports:
      ['8055']`, healthcheck, `depends_on: directus: service_healthy`, `env_file: .env`, `stop_grace_period: 30s`),
      `backoffice-web` (healthcheck `/admin/config.json`, `env_file: .env`); chưa có `lb`.
- [ ] T012 Viết `compose/lb/shared-domain.conf` theo `contracts/compose.md` mục Định tuyến (`= /admin`, `/admin/` → web;
      còn lại → `upstream api_pool` gồm `directus:8055` và `backoffice-api:8055` theo kết quả T001 (a); không
      `keepalive`; `proxy_next_upstream error timeout`; `client_max_body_size 0`; `proxy_request_buffering off`;
      `proxy_read_timeout 300s`; header `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`) và service `lb` trong
      `compose/docker-compose.yml` (`nginx:1.28-alpine`, cổng 8090, mount conf read-only, `depends_on` web và api
      healthy).
- [ ] T013 Viết `deploy-tests/global-setup.ts`: chạy `compose/init-env.sh --out <tmp>/.env` rồi ghi thêm
      `AUTH_LOGIN_ATTEMPTS=5`, `TUS_CHUNK_SIZE=1mb` (giá trị test, contracts/tests.md); `docker compose -p bo-deploy
      up -d --wait` với `BACKOFFICE_REPLICAS=3`, `BACKOFFICE_TAG=${BACKOFFICE_TAG:-local}`, thêm override khi
      `DEPLOY_MODE=separate-domain`; teardown `down -v`; khi `DEPLOY_KEEP=1` thì không teardown (dev). Kiểm bằng tay:
      `docker build` hai image `:local` rồi `pnpm nx run parity-tests:deploy` lên env và xuống sạch.
- [ ] T014 Viết `deploy-tests/smoke.test.ts`: 4 instance trả `GET /server/ping` = `pong`, `GET /server/health` 200 qua
      `lb`, `GET /admin/config.json` qua `lb` có `apiUrl` = `http://localhost:8090`; `docker compose ps` cho thấy 3
      replica `backoffice-api`; chạy xanh.

**Checkpoint**: `BACKOFFICE_REPLICAS=3 docker compose up -d --wait` lên 3 replica + Directus; `smoke.test.ts` xanh.

## Phase 3: User Story 8 - FE một image cho mọi môi trường (Priority: P2) — Lượt 1

**Goal**: image FE phục vụ `/admin` giống Directus (index `no-cache`, asset `immutable`, SPA fallback kể cả path có
đuôi), CSP sinh từ env lúc khởi động, probe không phụ thuộc BE (FR-001..FR-006, D-120).

**Independent Test**: chạy hai container FE cùng image với `PUBLIC_URL` khác nhau; so header `/admin` với header
Directus đo ở T001 (f) và với Directus chạy cùng env ghi đè.

### Tests cho User Story 8

- [ ] T020 [P] [US8] Viết `deploy-tests/web-image.test.ts` theo `contracts/images.md`: (1) `docker run -d -e
      PUBLIC_URL=http://a.test hiennd23/backoffice-web:<tag>` và một container với `http://b.test`: `config.json` khác
      nhau, `Cache-Control: no-store`; (2) `GET /admin` và `/admin/` → 200, body chứa `<div id="app"`, `Cache-Control:
      no-cache`, `Vary: Origin, Cache-Control`; (3) `GET /admin/content/x` và `/admin/missing.js` → 200 `index.html`;
      (4) một asset thật từ `index.html` → `Cache-Control: max-age=31536000, immutable`; (5) CSP: với ba bộ env (mặc
      định; `CONTENT_SECURITY_POLICY_DIRECTIVES__SCRIPT_SRC=array:'self','unsafe-eval',https://cdn.test`;
      `CONTENT_SECURITY_POLICY_USE_DEFAULTS=false`) header CSP của FE bằng đúng header Directus 11.17.4 trả cho `/admin`
      khi chạy `docker run directus/directus:11.17.4` với cùng env (Directus tạm trên SQLite, `SECRET`, `KEY`,
      `ADMIN_*`); (6) `GET /` → 302 `/admin/`; (7) `docker inspect` nhãn OCI có `org.opencontainers.image.version`,
      `.revision`. Chạy đỏ.

### Implementation cho User Story 8

- [ ] T021 [US8] Sửa `apps/web/nginx.conf`: `location = /admin { try_files /admin/index.html =404; add_header
      Cache-Control "no-cache"; add_header Vary "Origin, Cache-Control"; }`; `location /admin/ { try_files $uri
      /admin/index.html; }` với `location = /admin/index.html` `no-cache` + `Vary`, các file khác `max-age=31536000,
      immutable` + `Vary` (dùng `map $uri` hoặc `location ~* ^/admin/.+\.(js|css|woff2|png|svg|...)$`); giữ
      `config.json` `no-store` và khối `.mjs`; `include /etc/nginx/conf.d/csp.inc;` ở mức `server`. Ghi comment nguồn
      `directus/api/src/app.ts:277-290`.
- [ ] T022 [US8] Sửa `apps/web/docker/40-config.sh`: ngoài `config.json`, sinh `/etc/nginx/conf.d/csp.inc` chứa
      `add_header Content-Security-Policy "<chuỗi>" always;` theo thuật toán `contracts/images.md` mục CSP (mặc định
      helmet khi `USE_DEFAULTS` ≠ `false`, gộp directive Directus `app.ts:166-195`, áp
      `CONTENT_SECURITY_POLICY_DIRECTIVES__*` qua `env | awk`, bỏ directive khi `false`/rỗng); chuỗi mặc định và thứ
      tự khớp mốc T001 (f); biến `CONTENT_SECURITY_POLICY_*` khác → cảnh báo stderr; thêm `csp.inc` mặc định (rỗng hợp
      lệ) vào image để nginx khởi động được nếu script không chạy. Sửa `apps/web/Dockerfile`: `COPY` csp mặc định, `ARG
      BACKOFFICE_VERSION VCS_REF` + `LABEL org.opencontainers.image.{title,version,revision,source}` (FR-022).
- [ ] T023 [US8] Build `hiennd23/backoffice-web:local` với `--build-arg VCS_REF=$(git rev-parse HEAD)`, chạy T020 xanh;
      chạy lại E2E `apps/web-e2e` cấu hình `proxy-directus` một spec khói (`login`) trên env parity (hỏi 018 trước khi
      `env-up`) để chắc `nginx.conf` mới không phá `web` profile.

**Checkpoint**: `web-image.test.ts` xanh; CSP FE bằng CSP Directus ở ba bộ env.

## Phase 4: User Story 1 - Thay một instance Directus bằng BE mới chỉ bằng cách đổi image (Priority: P1) 🎯 MVP — Lượt 1

**Goal**: image BE có nhãn phiên bản, thay được image Directus trong một service có sẵn mà không đổi env, volume, probe
(FR-020..FR-024, D-121).

**Independent Test**: tạo container BE từ đúng service definition của `directus` trong compose (chỉ đổi image); health,
đăng nhập, upload; so env và mount bằng `docker inspect`.

### Tests cho User Story 1

- [ ] T030 [P] [US1] Viết `deploy-tests/image-swap.test.ts`: (1) `docker run -d --name bo-swap` với image
      `hiennd23/backoffice-api:<tag>`, env lấy nguyên từ `docker inspect` container `directus` (`Config.Env`), cùng
      network `bo-deploy_default`, cùng `Mounts` (`docker compose run` không đổi được image nên dùng `docker run`);
      chờ `/server/health` 200; đăng nhập admin; `POST /files` một ảnh nhỏ; `GET /files/<id>` qua Directus (8095)
      thấy file; (2) `docker inspect` hai container: tập `Config.Env`
      bằng nhau, `Mounts` (Destination) bằng nhau, `Config.User`/uid bằng nhau; (3) nhãn
      `io.backoffice.directus-compat=11.17.4`, `org.opencontainers.image.revision` có; (4) log khởi động có cảnh báo cho
      biến chỉ Directus dùng nếu thêm `PM2_INSTANCES=2` và `SERVE_APP=true` vào env (không dừng); (5) với DB rỗng (Postgres
      tạm `docker run`), BE thoát mã ≠ 0 và log nêu migration thiếu. Chạy đỏ (nhãn chưa có).

### Implementation cho User Story 1

- [ ] T031 [US1] Sửa `apps/api/Dockerfile`: `ARG BACKOFFICE_VERSION=0.0.0 VCS_REF=unknown`; `LABEL
      org.opencontainers.image.title="backoffice-api" org.opencontainers.image.version=$BACKOFFICE_VERSION
      org.opencontainers.image.revision=$VCS_REF org.opencontainers.image.source="<URL repo>"
      io.backoffice.directus-compat="11.17.4"`; không `HEALTHCHECK` (R3); giữ nguyên phần còn lại. Đọc
      `BACKOFFICE_VERSION` mặc định từ `apps/api/package.json` trong lệnh build của CI (T110), không trong Dockerfile.
- [ ] T032 [US1] Build `hiennd23/backoffice-api:local` với `--build-arg`, chạy T030 xanh; ghi vào `deploy/README.md`
      (tạo file, mục "Thay image Directus bằng Backoffice") các giới hạn FR-024: DB phải đã bootstrap, bỏ `command`/`args`
      gọi CLI Directus, extension không chạy, `PM2_*`/`SERVE_APP` chỉ cảnh báo.
- [ ] T033 [US1] Đóng lượt 1: `pnpm nx run-many -t lint,typecheck -p parity-tests web`; `parity-tests:deploy` xanh
      (smoke, web-image, image-swap); commit `feat(019): FE image serves /admin like Directus with CSP from env; OCI
      labels; deploy compose base and test harness` (Co-Authored-By theo quy ước); gửi hash + path cho 018; chờ id run;
      CI xanh (job `docker`, `e2e-web` phải còn xanh vì `nginx.conf` đổi); `graphify update .`.

**Checkpoint**: Image BE và FE có nhãn; đổi image Directus → BE chạy được không đổi env.

## Phase 5: User Story 2 - Docker-compose cho máy dev (Priority: P1) — Lượt 2

**Goal**: một lệnh dựng đủ hệ thống (FR-040..FR-044), thứ tự khởi động đúng, số replica đổi bằng biến, mỗi instance gọi
thẳng được.

**Independent Test**: trên máy sạch `./init-env.sh && docker compose up -d --wait`, đăng nhập qua `/admin`, log `lb` cho
thấy request rơi vào cả hai replica.

### Tests cho User Story 2

- [ ] T040 [P] [US2] Viết `deploy-tests/compose.test.ts`: (1) `docker compose config` của `directus` và `backoffice-api`
      có cùng `env_file` và không có `environment:` riêng (FR-041; so `docker inspect Config.Env` của hai container trừ
      `PATH`, `HOSTNAME`, `NODE_VERSION`, `YARN_VERSION`, biến image của Directus); (2) `docker compose ps --format json`:
      mọi service `healthy` hoặc `exited 0` (`minio-init`), `backoffice-api` có đúng `BACKOFFICE_REPLICAS` container; (3)
      thứ tự: `docker inspect .State.StartedAt` của `backoffice-api-*` > `directus` > `postgres`/`redis` (FR-042); (4)
      100 request `GET /server/info` qua `lb` rơi vào ≥ 3 `$upstream_addr` khác nhau trong log `lb` (xoay vòng gồm
      Directus); (5) `GET /admin/content` và `/admin/files/abc` qua `lb` trả `index.html`; `GET /` qua `lb` trả như
      Directus (`ROOT_REDIRECT`, 302 `./admin`). Chạy đỏ ở (4) nếu `lb` chưa ghi log upstream.

### Implementation cho User Story 2

- [ ] T041 [US2] Hoàn thiện `compose/docker-compose.yml` và `compose/lb/shared-domain.conf`: `log_format upstream` (như
      `tests/parity/proxy/nginx.conf.template`) để test đọc `$upstream_addr`; `name: bo-deploy`; comment đầu file theo
      kiểu `dev/directus-reference/docker-compose.yml` (lệnh, cổng, tài khoản); đảm bảo `minio-init` chạy trước
      `directus` (`depends_on: minio-init: service_completed_successfully`); volume đặt tên cho pg, redis, minio.
- [ ] T042 [US2] Viết `deploy/README.md` mục "Máy dev": lệnh của `quickstart.md`, bảng cổng (8090 lb, 8091 lb domain
      riêng, 8095 Directus, replica BE cổng ngẫu nhiên), cách xem log, `BACKOFFICE_REPLICAS`, `BACKOFFICE_TAG`, `down
      -v`; mục "Ràng buộc đa replica" (Redis bắt buộc, `CACHE_STORE`/`RATE_LIMITER_STORE` ≠ `memory`, storage S3 hoặc
      volume RWX, cảnh báo một instance của 001).
- [ ] T043 [US2] Chạy T040 xanh; kiểm bằng tay SC-007: từ `docker compose down -v`, đo thời gian `init-env.sh` + `up -d
      --wait` tới đăng nhập được ở `http://localhost:8090/admin` (image đã có) và ghi vào `research.md` "Kết quả T043".

**Checkpoint**: compose dev đầy đủ; `compose.test.ts` xanh.

## Phase 6: User Story 3 + 4 - Đăng nhập một lần gọi mọi replica; sửa schema thấy ngay (Priority: P1) — Lượt 2

**Goal**: không sticky session (FR-030), schema/permission/cache dùng chung hiện ngay ở mọi instance (FR-063).

**Independent Test**: BE 3 replica + Directus; đăng nhập ở 1, gọi ở 4; `POST /fields` ở A, đọc ở B, C, D ngay sau
response.

### Tests cho User Story 3 và 4

- [ ] T050 [P] [US3] Viết `deploy-tests/sessions.test.ts` theo `contracts/tests.md`: `mode: json` (Bearer), `cookie`
      (refresh cookie), `session` (session cookie) đăng nhập ở replica 1; `GET /users/me` và `GET /items/directus_users`
      (hoặc collection mẫu tạo trong test) 200 cùng `id` ở cả 4 instance; `POST /auth/refresh` ở replica 2 rồi token
      mới dùng được ở replica 3 và Directus; `POST /auth/logout` ở Directus rồi token cũ 401 ở cả 3 replica; đăng nhập
      sai 5 lần luân phiên 4 instance với user test → lần 6 với mật khẩu đúng bị từ chối (`USER_SUSPENDED` hoặc mã Directus
      dùng; so với hành vi Directus một instance bằng chính Directus 8095), giải khóa sau test bằng `PATCH /users`.
- [ ] T051 [P] [US4] Viết `deploy-tests/schema.test.ts`: `POST /collections` `bo_deploy_<ts>` ở replica 1; ngay khi có
      response, `GET /collections/<name>` và `GET /fields/<name>` ở replica 2, 3 và Directus → 200 (không retry, không
      sleep: FR-063); `POST /fields/<name>` ở Directus → `GET /fields/<name>/<field>` 200 ở 3 replica; tạo policy + role
      + user, sửa `permissions` ở Directus → request của user đó ở replica 1 thấy quyền mới ngay; `CACHE_ENABLED`: `GET
      /items/<name>` ở replica 1 (cache), `PATCH` ở replica 2, `GET` lại ở replica 1 và 3 trả bản mới; dọn collection
      cuối test.

### Implementation cho User Story 3 và 4

- [ ] T052 [US3] [US4] Chạy T050, T051 trên compose 3 replica. Kỳ vọng xanh không cần sửa (002–011 đã dùng chung
      Redis). Nếu đỏ: ghi nguyên nhân vào `research.md` "Kết quả T052"; nếu nguyên nhân ở code API thì DỪNG và hỏi chủ
      dự án (quy ước); nếu ở cấu hình compose (ví dụ thiếu `CACHE_AUTO_PURGE`, `REDIS` cho rate limiter) thì sửa
      `compose/.env.example` + README.

**Checkpoint**: `sessions.test.ts`, `schema.test.ts` xanh với 4 instance.

## Phase 7: User Story 5 - Flow theo lịch chạy một lần; TUS nhiều chunk qua nhiều replica (Priority: P1) — Lượt 2

**Goal**: lock lịch và dữ liệu dở TUS dùng chung đúng với N replica (FR-061, FR-062).

**Independent Test**: flow `*/2 * * * * *` qua 10 lượt đếm đúng 10; upload 4+ chunk xoay vòng 4 instance, SHA-256 trên
MinIO khớp.

### Tests cho User Story 5

- [ ] T060 [P] [US5] Viết `deploy-tests/flows-schedule.test.ts`: tạo flow `trigger: schedule`, `options.cron: '*/2 * * *
      * *'`, operation `log` (theo `tests/parity/src/flows/schedule.test.ts`); chờ ≥ 22 s (≥ 10 lượt) rồi đếm
      `directus_revisions`/`directus_activity` của flow qua `GET /activity?filter[collection]=directus_flows` hoặc
      cách đếm của 009 (`contracts/tests.md`); kỳ vọng số lượt = số lần chạy ±0; `docker kill -s TERM` replica đang
      giữ khóa (xác định qua log `lb`/log flow của từng container) rồi chờ 2 lượt nữa, đếm tiếp vẫn đủ; đặt flow
      `inactive`, scale lại 3.
- [ ] T061 [P] [US5] Viết `deploy-tests/tus.test.ts` dùng `tests/parity/src/tus-request.ts`: file ngẫu nhiên 4.5 MB
      (`TUS_CHUNK_SIZE=1mb` → 5 chunk); `POST /files/tus` ở replica 1 (lấy `Location`, chuyển host sang từng instance);
      chunk k `PATCH` tới instance k mod 4 (gồm Directus); `HEAD` ở instance kế để lấy `Upload-Offset`; sau chunk cuối
      `GET /files/<id>` 200, tải `GET /assets/<id>` qua Directus và một replica → SHA-256 bằng file gốc; `GET
      /files?filter[filename_download]` đúng 1 dòng; lần 2: sau chunk 2, `docker kill -s TERM` instance vừa nhận
      chunk, `HEAD` ở instance khác → offset = 2 chunk, gửi tiếp tới xong, `docker compose up -d --scale backoffice-api=3`.

### Implementation cho User Story 5

- [ ] T062 [US5] Chạy T060, T061. Kỳ vọng xanh (009 lock Redis, 007 TUS dùng chung). Nếu đỏ: như T052 (ghi "Kết quả
      T062"; code API → hỏi; compose → sửa `.env.example`/README). Riêng TUS: nếu `Location` trả về `PUBLIC_URL` là
      `http://localhost:8090` (lb) thì test đổi host sang từng instance là đúng thiết kế, ghi vào README mục "TUS sau load
      balancer".

**Checkpoint**: 10 lượt = 10 lần chạy; TUS qua 4 instance xong, byte khớp.

## Phase 8: User Story 6 - Tắt hoặc thêm replica khi đang có tải không làm lỗi request (Priority: P1) — Lượt 2

**Goal**: SIGTERM một replica dưới tải → 0 lỗi qua `lb`, mã thoát 143, kết nối DB/Redis đóng (FR-033..FR-035,
FR-064, SC-002).

**Independent Test**: `autocannon` 60 s qua `lb`, TERM một replica ở giây 15, scale lại ở giây 35, đếm lỗi.

### Tests cho User Story 6

- [ ] T070 [US6] Viết `deploy-tests/shutdown.test.ts`: `autocannon` (có trong `tests/parity`) 60 s, 20 kết nối, 2 luồng
      request: `GET /items/<collection mẫu>?limit=1` và `POST /items/<collection>` + `DELETE` (body nhỏ) với Bearer
      admin, qua `lbUrl`; giây 15 `docker kill -s TERM bo-deploy-backoffice-api-2`, ghi `docker wait` → mã 143 và thời
      gian từ TERM tới thoát ≤ 30 s; trước TERM đếm kết nối của container đó ở Postgres (`SELECT count(*) FROM
      pg_stat_activity WHERE client_addr = '<ip container>'` qua `knex`/`pg` với `DB_*` của `.env` qua cổng publish tạm
      hoặc `docker exec postgres psql`) và Redis (`docker exec redis redis-cli CLIENT LIST` lọc `addr=<ip>`), sau thoát
      cả hai = 0; giây 35 `docker compose up -d --scale backoffice-api=3 --no-recreate`; kết quả autocannon: `errors
      === 0`, `non2xx === 0` (ngoài 204 của DELETE), `requests.total ≥ 5000`; in bảng số liệu; replica mới sẵn sàng (health
      200 qua cổng của nó) trong ≤ 30 s kể từ `StartedAt` (SC-008).

### Implementation cho User Story 6

- [ ] T071 [US6] Chạy T070. Nếu có `errors`/5xx: kiểm log `lb` (`$upstream_addr`, `$upstream_status`), xác định cửa sổ
      R4; sửa trong phạm vi cấu hình: `proxy_next_upstream error timeout http_502` (chỉ cho request idempotent: tách
      `location` GET/HEAD), `stop_grace_period`, hoặc `entrypoint` bọc `sh -c 'trap "sleep N; kill -TERM \$pid" TERM; node
      dist/main.js & pid=$!; wait $pid'` trong compose (không đổi image, không biến mới; ghi `ponytail:` nếu dùng và lý do
      vào `research.md` "Kết quả T071"). Không sửa `apps/api/src`.
- [ ] T072 [US6] Ghi vào `deploy/README.md` mục "Tắt máy an toàn": trình tự 001 (FR-080), khoảng trễ ở đâu (compose: retry
      nginx; Kubernetes: `preStop`), công thức grace ≥ delay + `SERVER_SHUTDOWN_TIMEOUT` + đóng kết nối, request dài hơn
      `SERVER_SHUTDOWN_TIMEOUT` bị cắt (edge case của spec), cách tăng biến này trong cấu hình chung, D-122.
- [ ] T073 [US6] Đóng lượt 2: `lint`, `typecheck`; `parity-tests:deploy` xanh toàn bộ (smoke, web-image, image-swap,
      compose, sessions, schema, flows-schedule, tus, shutdown); commit `feat(019): dev compose with N replicas behind
      nginx; multi-instance acceptance suite`; gửi hash + path cho 018; CI xanh (job `deploy` chưa có, chỉ job hiện tại);
      `graphify update .`.

**Checkpoint**: 0 lỗi khi tắt/thêm replica dưới tải; bộ test chung domain xanh.

## Phase 9: User Story 9 - Bản Backoffice ở domain riêng, chung DB, Redis, S3 (Priority: P2) — Lượt 3

**Goal**: override compose cho domain riêng, chỉ đặt riêng `PUBLIC_URL` (FR-070..FR-075).

**Independent Test**: `DEPLOY_MODE=separate-domain`: Directus ở 8090, Backoffice ở 8091; `Location` TUS và link mời theo
8091; sửa ở 8090 thấy ở 8091.

### Tests cho User Story 9

- [ ] T080 [P] [US9] Viết `deploy-tests/separate-domain.test.ts` (chỉ chạy khi `DEPLOY_MODE=separate-domain`, `describe.skipIf`):
      (1) `GET http://127.0.0.1:8090/admin` trả app Directus (body có `directus`), `GET :8091/admin` trả app Backoffice
      (`config.json` `apiUrl` = `http://localhost:8091`); (2) `POST /files/tus` qua 8091 → `Location` bắt đầu
      `http://localhost:8091/files/tus/`; (3) link sinh từ `PUBLIC_URL`: tạo share trên collection mẫu rồi `POST
      /shares/invite` qua 8091 (D-36 của 010: không gửi mail, log một dòng cảnh báo mỗi email chứa URL
      `PUBLIC_URL/admin/shared/<id>`) → `docker compose logs backoffice-api` có `http://localhost:8091/admin/shared/<id>`
      (user invite không dùng được: dòng log D-27 không chứa URL); (4)
      `POST /collections` qua 8090 (Directus) → `GET /collections/<name>` qua 8091 200 ngay; `PATCH /settings` qua 8091
      → `GET /settings` qua 8090 thấy ngay; (5) `Set-Cookie` của `POST /auth/login` `mode: session` qua 8091 không có
      `Domain=`; (6) 50 request qua 8091 chỉ rơi vào `backoffice-api` trong log `lb` (không `directus:8055`); 20 request
      qua 8090 chỉ rơi vào `directus:8055`; (7) `docker inspect` `backoffice-api`: `Config.Env` = env của `directus` +
      đúng một biến khác giá trị `PUBLIC_URL`. Chạy đỏ (chưa có override).

### Implementation cho User Story 9

- [ ] T081 [US9] Viết `compose/docker-compose.separate-domain.yml` (`backoffice-api`, `backoffice-web`: `environment:
      PUBLIC_URL: http://localhost:8091`; `lb`: cổng 8090 và 8091, mount `lb/separate-domain.conf`) và
      `compose/lb/separate-domain.conf` theo `contracts/compose.md` (8090 → `directus:8055` mọi path; 8091 → `/admin` web,
      còn lại `upstream bo_pool` chỉ `backoffice-api`); cùng các chỉ thị proxy của T012.
- [ ] T082 [US9] Sửa `deploy-tests/global-setup.ts` nếu cần (override, chờ 8091); chạy `DEPLOY_MODE=separate-domain pnpm
      nx run parity-tests:deploy` → T080 xanh; các test chung domain `skipIf` ở chế độ này trừ `smoke`, `sessions`,
      `schema` (chạy được với 3 replica + Directus gọi thẳng, không qua lb).
- [ ] T083 [US9] Ghi `deploy/README.md` mục "Domain riêng": khi nào dùng, chỉ `PUBLIC_URL` được đặt riêng (FR-071) và lý do
      (các chỗ Directus dùng `PUBLIC_URL`, R10), SSO (callback của domain B ở IdP; thêm URL domain B vào
      `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST`, `AUTH_ALLOWED_PUBLIC_URLS` của cấu hình chung), cookie, giới hạn cache
      `/server/specs/oas` chung host, phiên không chia sẻ giữa hai domain; mục "Cookie domain" (FR-076): bảng
      `contracts/helm-values.md`, lệnh tự kiểm cho compose và manifest thường (`grep COOKIE_DOMAIN .env`, `kubectl get
      cm,secret <tên> -o yaml | grep COOKIE_DOMAIN`), cách sửa env Directus (bỏ biến hoặc đặt domain cha).

**Checkpoint**: `separate-domain.test.ts` xanh; `.env` không đổi giữa hai chế độ.

## Phase 10: User Story 7 - Helm chart dùng lại ConfigMap và Secret của Directus (Priority: P2) — Lượt 3

**Goal**: chart tạo Deployment/Service/Ingress/HPA, `envFrom` ConfigMap/Secret có sẵn, nhãn pool, probe, `preStop`,
không chứa biến Directus (FR-045..FR-052, FR-070..FR-072 phía chart).

**Independent Test**: `helm lint`; `helm template | kubeconform -strict`; cài trên kind với ConfigMap/Secret kiểu
Directus; Ingress định tuyến; rolling restart dưới tải 0 lỗi.

### Tests cho User Story 7

- [ ] T090 [P] [US7] Viết `deploy/helm/backoffice/ci/test-template.sh` (POSIX sh, chạy được local và CI): `helm lint
      chart/`; `helm template bo chart/ --set directus.configMap=cm --set directus.secret=sec --set
      ingress.host=h.test > /tmp/a.yaml`; `kubeconform -strict -kubernetes-version 1.29.0 -summary /tmp/a.yaml`; kiểm
      bằng `grep`/`yq` (nếu có, không thì `grep -c`): không có `name: PUBLIC_URL` trong a.yaml; `envFrom` có `cm` và
      `sec` ở api, chỉ `cm` ở web; selector Service api chỉ có `backoffice.io/api-pool`; readiness path
      `/server/health`, liveness và startup `/server/ping`; `preStop` `sleep 10`; `terminationGracePeriodSeconds: 30`;
      `maxUnavailable: 0`; HPA `autoscaling/v2` có; `runAsNonRoot: true`; với `-f values-separate-domain.yaml` thêm
      `--set directus.configMap=cm --set directus.secret=sec`: có đúng một `name: PUBLIC_URL` ở api và một ở web, không có
      biến khác; không có `COOKIE_DOMAIN` nào trong output ở mọi bộ values; với `--set
      uploads.existingClaim=pvc` có volume ở `/directus/uploads`; `--set ingress.extraPaths[0].path=/auth/login/saml`…
      ra trước `/`. Chạy đỏ (chưa có chart).
- [ ] T091 [P] [US7] Viết `deploy/helm/backoffice/ci/kind-test.sh`: tạo cụm kind (bản T001), `kind load docker-image`
      hai image `:local`, cài Traefik (chart bản T001) với `hostPort` 80, `kubectl apply -f ci/deps.yaml` (Postgres,
      Redis, MinIO, `minio-init` Job, Directus 11.17.4 Deployment + ConfigMap `directus-config` + Secret
      `directus-secret` với cùng khóa như `compose/.env.example`, `PUBLIC_URL=http://cms.test`), chờ Directus Ready; `helm
      install bo chart/ -f ci/values-kind.yaml --wait --timeout 5m`; `curl -H 'Host: cms.test' localhost/admin/` → 200
      HTML; `/server/ping` → `pong`; thêm nhãn pool vào Directus (`kubectl patch deployment directus`) rồi 50 request
      `/server/info` qua Ingress rơi vào ≥ 2 pod (kiểm `kubectl logs`); FR-076: tạo ConfigMap `directus-config-cookie` (bản
      sao có `REFRESH_TOKEN_COOKIE_DOMAIN=cms.test`), `helm install bo2 chart/ -f values-separate-domain.yaml --set
      directus.configMap=directus-config-cookie --set ingress.host=backoffice.test` → thoát ≠ 0 và stderr chứa
      `REFRESH_TOKEN_COOKIE_DOMAIN="cms.test"` cùng `backoffice.test`; lặp lại với giá trị `test` → cài được, rồi gỡ; `autocannon` 60 s qua Ingress, giây 10 `kubectl
      rollout restart deployment/bo-api`, giây 35 `kubectl scale --replicas=4`, giây 50 `--replicas=2` → `errors == 0`,
      `non2xx == 0`; `kubectl get hpa bo-api` tồn tại; `helm uninstall`; `kind delete cluster`. Chạy đỏ.

### Implementation cho User Story 7

- [ ] T092 [US7] Viết `chart/Chart.yaml` (`apiVersion: v2`, `name: backoffice`, `version: 0.1.0`, `appVersion` = version
      của `apps/api/package.json`, `kubeVersion: ">=1.29.0-0"`), `chart/values.yaml` đúng bảng `contracts/helm-values.md`
      (kèm comment từng key), `chart/values-separate-domain.yaml` (ví dụ trong contract), `chart/templates/_helpers.tpl`
      (tên, nhãn chuẩn `app.kubernetes.io/*`, nhãn pool), `chart/.helmignore`.
- [ ] T093 [P] [US7] Viết `chart/templates/api-deployment.yaml` (envFrom `required`, `env` chỉ `PUBLIC_URL` khi
      `domain.publicUrl` khác rỗng, probe theo `contracts/images.md`, `lifecycle.preStop.exec sleep`, `terminationGracePeriodSeconds`,
      `strategy`, `securityContext` uid 1000, `resources`, volume `uploads.existingClaim`, `replicas` chỉ khi autoscaling
      tắt), `chart/templates/api-service.yaml` (selector chỉ nhãn pool), `chart/templates/api-hpa.yaml`
      (`autoscaling/v2`, CPU utilization).
- [ ] T094 [P] [US7] Viết `chart/templates/web-deployment.yaml` (envFrom chỉ ConfigMap, `env PUBLIC_URL` khi
      `domain.publicUrl`, probe `/admin/config.json`, uid 101, `resources`), `chart/templates/web-service.yaml`,
      `chart/templates/ingress.yaml` (`ingress.extraPaths` trước, `/admin` Prefix → web 8080, `/` Prefix → api 8055,
      `className`, `tls`, `annotations`), `chart/templates/NOTES.txt` (URL, cách thêm nhãn pool cho Directus, chế độ domain
      riêng).
- [ ] T095 [P] [US7] Viết `chart/templates/_checks.tpl` (FR-076, research R7): khi `domain.publicUrl` khác rỗng, `lookup`
      ConfigMap `directus.configMap` và Secret `directus.secret` (giá trị `b64dec`); với `REFRESH_TOKEN_COOKIE_DOMAIN`,
      `SESSION_COOKIE_DOMAIN` có giá trị `v`, `d = trimPrefix "." v`; nếu `ingress.host` ≠ `d` và không kết thúc bằng
      `.d` thì `fail` đúng thông báo trong `contracts/helm-values.md` (tên biến, giá trị, ConfigMap/Secret, host, cách
      sửa env Directus); gọi `include "backoffice.checks" .` ở đầu `api-deployment.yaml`.
- [ ] T096 [US7] Chạy `ci/test-template.sh` xanh (sửa template tới khi `kubeconform` và các `grep` đạt).
- [ ] T097 [US7] Viết `chart/ci/deps.yaml` và `chart/ci/values-kind.yaml` (image `:local`, `pullPolicy: Never`,
      `directus.configMap=directus-config`, `directus.secret=directus-secret`, `ingress.host=cms.test`,
      `api.autoscaling.enabled=true` với `minReplicas 2`, `resources` nhỏ); chạy `ci/kind-test.sh` local xanh (cần
      Docker đủ RAM; nếu máy không chạy được kind, ghi rõ và để CI T111 kiểm).
- [ ] T098 [US7] Ghi `deploy/README.md` mục "Kubernetes": cài chart (quickstart), values chính, cách đưa Directus vào pool
      (nhãn + `preStop`, gỡ Ingress trùng host; `contracts/helm-values.md`), Ingress annotation cho Traefik và
      ingress-nginx (`proxy-body-size: "0"`, `proxy-request-buffering: "off"`, `proxy-read-timeout`) (FR-051), SAML về
      Directus qua `ingress.extraPaths` với ví dụ `/auth/login/<provider>` và `/auth/login/<provider>/acs` (FR-052,
      D-24 của 003), PVC RWX cho storage `local` (FR-047), HPA cần metrics-server, `helm template` cho nơi không dùng Helm.
- [ ] T099 [US7] Đóng lượt 3: `lint`, `typecheck`; `parity-tests:deploy` hai chế độ xanh; `ci/test-template.sh` xanh;
      commit `feat(019): separate-domain compose override; Helm chart reusing the Directus ConfigMap and Secret`; gửi
      hash + path cho 018; CI xanh; `graphify update .`.

**Checkpoint**: chart lint/schema xanh; cài trên kind, Ingress đúng, rolling restart 0 lỗi.

## Phase 11: CI, tài liệu, Polish — Lượt 4

**Purpose**: đưa hai bộ test vào CI làm cổng của `publish` (FR-065), hoàn thiện tài liệu, đóng feature.

- [ ] T110 Sửa `.github/workflows/ci.yml` job `docker`: build hai image với `--build-arg BACKOFFICE_VERSION=$(node -p
      "require('./apps/api/package.json').version") --build-arg VCS_REF=$GITHUB_SHA`; thêm bước `docker inspect` kiểm
      nhãn `org.opencontainers.image.revision == $GITHUB_SHA`.
- [ ] T111 [P] Thêm job `deploy` vào `ci.yml` (needs `docker`, `timeout-minutes: 40`): checkout, setup-node 22,
      `pnpm install --frozen-lockfile`, download + load image, tag `:local`, `pnpm nx run parity-tests:deploy`, rồi
      `DEPLOY_MODE=separate-domain pnpm nx run parity-tests:deploy`; `if: failure()` dump `docker compose -p bo-deploy
      logs` thành artifact `deploy.log`; `if: always()` `down -v`.
- [ ] T112 [P] Thêm job `deploy-k8s` vào `ci.yml` (needs `docker`, `timeout-minutes: 40`): `azure/setup-helm` (bản T001),
      cài `kubeconform` (tải binary bản T001, kiểm checksum), `helm/kind-action` (bản T001), download + load image,
      `deploy/helm/backoffice/ci/test-template.sh`, `deploy/helm/backoffice/ci/kind-test.sh`; `if: failure()` `kubectl
      get pods -A`, `kubectl describe`, log pod api thành artifact.
- [ ] T113 Thêm `deploy`, `deploy-k8s` vào `needs` của job `publish` trong `ci.yml`; kiểm `actionlint` nếu có trong repo
      (không thì `node -e "require('js-yaml').load(...)"`) để YAML hợp lệ.
- [ ] T114 [P] Hoàn thiện `deploy/README.md`: mục lục; "Hai chế độ" (chung domain mặc định, domain riêng); "Probe"
      (readiness `/server/health`, liveness `/server/ping`, lý do Q2); "CSP" (sinh từ env, các biến hỗ trợ, biến bỏ qua);
      "Giới hạn" (request dài hơn `SERVER_SHUTDOWN_TIMEOUT`, cache OAS chung host, storage `local` cần RWX, SAML, arm64
      ngoài phạm vi, nightly 001 FR-112 chưa bật lại); bảng tham chiếu FR → mục README. Thêm một dòng trỏ tới
      `deploy/README.md` trong `README.md` gốc và `SPECKIT-GUIDE.md` mục môi trường dev (giữ `dev/directus-reference` cho
      parity).
- [ ] T115 [P] Cập nhật `specs/019-deployment-packaging/spec.md`: bảng khác biệt D-120..D-122 (kiểm còn đúng sau T071;
      nếu dùng `entrypoint` bọc trong compose thì ghi vào D-122), "Kết quả" các task vào `research.md`, trạng thái
      checklist `checklists/requirements.md`; cập nhật mục `Active Technologies`/`Recent Changes` của `CLAUDE.md` (dòng
      019 đã có từ plan; sửa nếu khác thực tế).
- [ ] T116 Chạy toàn bộ: `pnpm nx run-many -t lint,typecheck`; `parity-tests:deploy` hai chế độ; `ci/test-template.sh`;
      (`ci/kind-test.sh` nếu máy chạy được); kiểm thủ công SC-004: lấy `docker compose config` của service `directus`,
      đổi `image` sang `hiennd23/backoffice-api:local`, `diff` chỉ ra một dòng; ghi số liệu SC-001..SC-010 vào
      `research.md` "Kết quả T116".
- [ ] T117 Đóng lượt 4: commit `ci(019): deploy and deploy-k8s jobs gate publish; deployment guide`; gửi hash + path
      cho 018; chờ CI xanh gồm `deploy`, `deploy-k8s`, `publish` (đẩy image có nhãn); nếu job mới đỏ vì flake môi
      trường (kind, Docker Hub rate limit) thì sửa trong commit tiếp theo theo quy ước `workflow-merge-main`; `graphify
      update .`; ghi memory feature 019 đóng (quyết định Q1, Q2, US9, bài học CI) theo cách các feature trước.

**Checkpoint**: CI xanh với hai job mới; `publish` đẩy image có nhãn; README đủ.

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 (Setup): T001 trước mọi task dùng kết quả của nó (T012 cần (a), T031 cần (b), T091/T112 cần (c)(d)(e), T020/T022
  cần (f), T011 cần (g)); T002, T003, T004 song song.
- Phase 2 (Foundational): T010 → T011 → T012 → T013 → T014 (tuần tự, cùng cụm file compose). Chặn mọi story về mặt
  chạy test; T020 và T030 (viết test) có thể viết song song với Phase 2 vì chỉ dùng `docker run`.
- Phase 3 (US8) và Phase 4 (US1) độc lập, cùng lượt 1; T033 đóng lượt sau cả hai.
- Phase 5 (US2) cần Phase 2; Phase 6, 7, 8 cần Phase 5 (compose hoàn thiện, log upstream). Phase 6 và 7 song song (khác
  file test, cùng env; chạy test tuần tự vì `fileParallelism: false`); Phase 8 sau 6 và 7 (tắt replica làm nhiễu test
  khác).
- Phase 9 (US9) cần Phase 5 và 8 (retry/`lb` ổn); Phase 10 (US7) cần Phase 3, 4 (image) và có thể song song Phase 9
  (khác thư mục).
- Phase 11 sau tất cả; T110 → T111/T112 → T113 → T116 → T117; T114, T115 song song với T111/T112.

### User Story Dependencies

- US8 (image FE): Phase 1. US1 (image BE): Phase 1. US2 (compose): Phase 2. US3, US4, US5: US2. US6: US2 (và sau
  US3–US5 khi chạy). US9: US2, US6. US7 (chart): US1, US8 (image), độc lập compose.

### Within Each User Story

- Test viết trước và chạy đỏ, rồi cấu hình; README cập nhật trong story; đóng lượt cuối lượt.

### Parallel Opportunities

- Phase 1: T002 | T003 | T004 (sau hoặc cùng lúc T001).
- Lượt 1: T020 | T030 (test) song song với Phase 2; T021 → T022 → T023 | T031 → T032; rồi T033.
- Lượt 2: T040 → T041 → T042 → T043; rồi T050 | T051 | T060 | T061 (viết) → T052 | T062 (chạy, tuần tự trên env) → T070 →
  T071 → T072 → T073.
- Lượt 3: [US9] T080 → T081 → T082 → T083 song song với [US7] T090 | T091 → T092 → T093 | T094 | T095 → T096 → T097 → T098; rồi
  T099.
- Lượt 4: T110 → T111 | T112 | T114 | T115 → T113 → T116 → T117.

## Parallel Execution Examples

```text
Lượt 1:
  T001 → song song: T002 | T003 | T004 | T020 (viết) | T030 (viết)
  tuần tự: T010 → T011 → T012 → T013 → T014
  song song: [US8] T021 → T022 → T023   |   [US1] T031 → T032
  rồi: T033

Lượt 2:
  T040 → T041 → T042 → T043
  song song (viết): T050 | T051 | T060 | T061
  tuần tự (chạy trên env): T052 → T062 → T070 → T071 → T072 → T073

Lượt 3:
  song song: [US9] T080 → T081 → T082 → T083   |   [US7] (T090 | T091) → T092 → (T093 | T094 | T095) → T096 → T097 → T098
  rồi: T099

Lượt 4:
  T110 → song song: T111 | T112 | T114 | T115 → T113 → T116 → T117
```

## Implementation Strategy

- **MVP** = lượt 1 (US8 + US1): hai image hoàn thiện, đổi image Directus → BE chạy được. Đã có giá trị cho vận hành
  dù chưa có compose/chart mới.
- Lượt 2 chứng minh đa replica bằng số liệu (SC-001, SC-002, SC-005, SC-006) trên compose; nếu một test đa instance
  đỏ vì code API, dừng và hỏi (quy ước), không vá trong 019.
- Lượt 3 thêm hai cách triển khai (domain riêng, Kubernetes) trên nền đã kiểm.
- Lượt 4 đưa vào CI làm cổng `publish`, tài liệu, đóng feature.
- Mỗi lượt là một commit do 018 push; không push khi 018 đang có run benchmark đang chạy nếu commit chạm
  `benchmark.yml` (019 không chạm).
