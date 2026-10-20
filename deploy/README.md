# Triển khai Backoffice

Tài liệu vận hành của feature 019 (`specs/019-deployment-packaging/`). Backoffice gồm hai image:

| Image                     | Nội dung                                              | Cổng | User                                |
| ------------------------- | ----------------------------------------------------- | ---- | ----------------------------------- |
| `hiennd23/backoffice-api` | API (BE), thay được image `directus/directus:11.17.4` | 8055 | `node` (1000:1000), PID 1 là `tini` |
| `hiennd23/backoffice-web` | App quản trị ở `/admin` (FE, nginx)                   | 8080 | `backoffice` (1001:1001)            |

Build tại máy (linux/amd64, qua `@nx-tools/nx-container`):

```bash
pnpm nx run api:container
pnpm nx run web:container
```

Image được gắn tag `hiennd23/backoffice-<app>:local` (compose của parity dùng) và `:latest`; lệnh không tự push lên
Docker Hub. Muốn push thì đăng nhập (`docker login`) rồi đặt `INPUT_API_PUSH=true` / `INPUT_WEB_PUSH=true` cho lệnh trên
(D-134).

Mục lục: [Thay image Directus bằng Backoffice](#thay-image-directus-bằng-backoffice) ·
[CSP của app quản trị](#csp-của-app-quản-trị) · [Máy dev](#máy-dev-deploycompose) ·
[Env Directus bắt buộc](#env-directus-bắt-buộc-khi-chạy-nhiều-instance) · [Tắt máy an toàn](#tắt-máy-an-toàn) ·
[Domain riêng](#domain-riêng) · [Kubernetes](#kubernetes-deployhelmbackoffice) · [Lệnh CLI](#lệnh-cli)

## Thay image Directus bằng Backoffice

Trong một service Directus đang chạy (compose hoặc Deployment Kubernetes), chỉ đổi `image:` thành
`hiennd23/backoffice-api:<tag>`. Env, volume (`/directus/uploads`, `/directus/database`, `/directus/extensions`), cổng
8055 và probe giữ nguyên: image Backoffice dùng cùng thư mục làm việc `/directus`, cùng uid/gid 1000, cùng cách đọc env,
`.env`, `CONFIG_PATH`, hậu tố `_FILE`.

Giới hạn (FR-024):

- DB phải đã được Directus khởi tạo. Backoffice không chạy `bootstrap` và không ghi bảng hệ thống khi khởi động: gặp DB
  trống hoặc thiếu migration thì dừng và báo migration nào lệch. DB mới: chạy image Directus một lần trước (hoặc giữ ít
  nhất một instance Directus). Nâng phiên bản Directus thì Directus chạy migration.
- Bỏ mọi ghi đè `command`/`args` gọi CLI Directus (ví dụ `npx directus bootstrap && pm2-runtime ...`). Trên Kubernetes,
  ghi đè `command` còn bỏ qua `tini` (ENTRYPOINT của image).
- Extension của Directus không chạy trên Backoffice.
- `SERVE_APP=true` chỉ gây một dòng cảnh báo: app quản trị chạy ở image web. Các biến `PM2_*` không có tác dụng (không
  phải biến của Directus, chỉ PM2 trong image Directus đọc): muốn thêm tiến trình thì tăng số replica.

## CSP của app quản trị

Container web gửi đúng header `Content-Security-Policy` mà Directus 11.17.4 gửi cho `/admin`, sinh lúc khởi động từ các
biến `CONTENT_SECURITY_POLICY_DIRECTIVES__*` và `CONTENT_SECURITY_POLICY_USE_DEFAULTS` của env chung
(`apps/web/docker/csp.awk`). Quy tắc giống Directus:

- Giá trị danh sách (`array:a,b` hoặc `a,b`) gộp **theo vị trí** với danh sách của Directus: muốn thêm một nguồn vào
  `img-src` phải liệt kê lại cả năm nguồn của Directus rồi mới tới nguồn mới.
- Giá trị `false` làm Directus không khởi động; container web bỏ biến đó và ghi cảnh báo.
- Các biến `CONTENT_SECURITY_POLICY_*` khác (`REPORT_ONLY`...) bị bỏ qua, có cảnh báo.

App ở origin khác API (không phải hai chế độ của 019): thêm origin của API vào `connect-src`, `img-src`, `media-src`, ví
dụ `CONTENT_SECURITY_POLICY_DIRECTIVES__CONNECT_SRC=array:'self',https://*,wss://*,https://api.example.com`.

Live preview (khung xem trang ở trang item) mở một site khác trong iframe: thêm site đó vào `frame-src`, ví dụ
`CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC=https://preview.example.com`. Directus cũng cần đúng biến này.

## Máy dev (`deploy/compose`)

Chỉ cần Docker. Directus 11.17.4, BE (mặc định 2 replica), FE, Postgres, Redis, MinIO (S3) và một load balancer nginx
non-root, dùng chung một file `.env` (Directus và BE đọc nguyên file này, chỉ khác image).

```bash
cd deploy/compose
./init-env.sh
docker compose up -d --wait
```

| Cổng trên máy | Dịch vụ                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| 8090          | load balancer: `/admin` vào FE, còn lại vào pool gồm Directus và các replica BE |
| 8091          | load balancer của chế độ domain riêng (Backoffice)                              |
| 8095          | Directus gọi thẳng                                                              |
| ngẫu nhiên    | mỗi replica BE: `docker compose port --index <i> backoffice-api 8055`           |

- Số replica: `BACKOFFICE_REPLICAS=3 docker compose up -d --wait`. Tag image: `BACKOFFICE_TAG=local` (mặc định
  `latest`).
- Log: `docker compose logs -f backoffice-api`; log truy cập của `lb` có cột upstream (`$upstream_addr`).
- Tắt: `docker compose down`; xóa cả dữ liệu: `docker compose down -v`.
- Test chấp nhận (BE 3 replica + 1 Directus): `pnpm nx run parity-tests:deploy`.

## Env Directus bắt buộc khi chạy nhiều instance

Áp cho cấu hình chung (`.env`, ConfigMap, Secret) mà mọi instance Directus và Backoffice cùng đọc (bảng của spec 019,
kiểm trong source Directus 11.17.4). Chart dừng cài khi thiếu một biến "Bắt buộc" (FR-053); BE vẫn khởi động với cấu
hình thiếu (cảnh báo một instance của 001 chưa có `SYNCHRONIZATION_STORE`).

**Bắt buộc** (thiếu thì hệ thống nhiều instance chạy sai):

| Biến                                                                                                      | Giá trị cần                                                | Mặc định Directus                            | Thiếu thì sao                                                                                                                   | Nguồn                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DB_CLIENT` + `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` (hoặc `DB_CONNECTION_STRING`) | cùng một DB thật cho mọi instance                          | image đặt `sqlite3` với file trong container | mỗi container một DB riêng                                                                                                      | `apps/api/Dockerfile`, `directus/Dockerfile`                                                                 |
| `SECRET`                                                                                                  | một chuỗi cố định, giống nhau ở mọi instance               | không có; mỗi process tự sinh ngẫu nhiên     | token do instance này cấp bị instance kia từ chối                                                                               | `directus/api/src/utils/get-secret.ts:13-18`                                                                 |
| `REDIS` (hoặc `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`...)                                            | trỏ cùng một Redis                                         | không có                                     | bus xóa cache schema/quyền và lock chỉ chạy trong từng process                                                                  | `directus/api/src/bus/lib/use-bus.ts:18`, `lock/lib/use-lock.ts:17`, `redis/utils/redis-config-available.ts` |
| `REDIS_ENABLED` (nếu có đặt)                                                                              | `true`                                                     | không có                                     | có đặt mà khác `true` thì Redis bị tắt dù có `REDIS`                                                                            | như trên                                                                                                     |
| `CACHE_STORE`                                                                                             | `redis`                                                    | `memory`                                     | cache hệ thống và lock cache riêng từng instance (kể cả khi `CACHE_ENABLED=false`)                                              | `directus/api/src/cache.ts:62-84`                                                                            |
| `RATE_LIMITER_STORE`                                                                                      | `redis`                                                    | `memory`                                     | bộ đếm lần đăng nhập (ngưỡng là setting `auth_login_attempts`) đếm riêng từng instance (kể cả khi `RATE_LIMITER_ENABLED=false`) | `directus/api/src/services/authentication.ts:34,137-149`                                                     |
| `SYNCHRONIZATION_STORE`                                                                                   | `redis`                                                    | không có (dùng bộ nhớ process)               | flow theo lịch, job dọn TUS, retention chạy trên mọi instance                                                                   | `directus/api/src/synchronization.ts:20`                                                                     |
| `STORAGE_LOCATIONS` + `STORAGE_<LOCATION>_DRIVER` và khóa của driver                                      | `s3` (hoặc `local` trên volume `ReadWriteMany` dùng chung) | `local`                                      | mỗi container thấy file khác nhau                                                                                               | Nguyên tắc VII                                                                                               |

**Bắt buộc theo tình huống**:

| Biến                                                              | Khi nào                                        | Giá trị cần                                                                                |
| ----------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `PUBLIC_URL`                                                      | dùng SSO, share, link mời; chế độ domain riêng | URL thật của domain (mặc định `/`); chế độ domain riêng: bản Backoffice đặt riêng (FR-071) |
| `TUS_ENABLED`                                                     | muốn upload TUS (mặc định `false`)             | `true`; cần thêm `REDIS` và storage dùng chung                                             |
| `REFRESH_TOKEN_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN`            | chế độ domain riêng                            | không đặt, hoặc domain cha phủ cả hai domain (FR-076)                                      |
| `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST`, `AUTH_ALLOWED_PUBLIC_URLS` | SSO và chế độ domain riêng                     | thêm URL của domain Backoffice                                                             |

**Khuyến nghị**:

| Biến                                | Giá trị                                                     | Lý do                                                                                                                |
| ----------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `WEBSOCKETS_ENABLED`                | `false` (mặc định)                                          | Backoffice không có `/websocket` (Nguyên tắc XI); Directus trong cùng pool mà bật thì chỉ một phần instance trả được |
| `CACHE_ENABLED`, `CACHE_AUTO_PURGE` | tùy; compose đặt `true`                                     | response cache dùng chung qua `CACHE_STORE=redis`                                                                    |
| `SERVER_SHUTDOWN_TIMEOUT`           | lớn hơn request dài nhất cần giữ khi tắt (mặc định 1000 ms) | FR-033, edge case request dài                                                                                        |
| `IP_TRUST_PROXY`                    | giữ mặc định `true`                                         | đứng sau load balancer (FR-051)                                                                                      |

Tự kiểm khi không dùng Helm:

```bash
# compose
grep -E '^(REDIS|CACHE_STORE|RATE_LIMITER_STORE|SYNCHRONIZATION_STORE|SECRET|DB_CLIENT|STORAGE_)' .env
# Kubernetes
kubectl get configmap <tên> -o yaml | grep -E 'REDIS|_STORE|DB_CLIENT|STORAGE_'
kubectl get secret <tên> -o jsonpath='{.data.SECRET}' | base64 -d | wc -c
```

## Tắt máy an toàn

Khi nhận SIGTERM, BE theo trình tự của 001: `/server/health` chuyển `error`, ngừng nhận kết nối mới, chờ request dở tối
đa `SERVER_SHUTDOWN_TIMEOUT` (mặc định 1000 ms), đóng DB, Redis và job theo lịch, rồi thoát mã 143 (`tini` là PID 1 nên
mã này về tới Docker và Kubernetes).

Khoảng trễ để load balancer gỡ replica ra trước khi nó ngừng nhận nằm ở cấu hình triển khai, không phải env:

- Kubernetes: `preStop` `sleep` (chart: `api.shutdownDelaySeconds`, mặc định 10) và `terminationGracePeriodSeconds` (mặc
  định 30).
- Compose: `lb` không giữ keepalive tới upstream, chuyển request chưa gửi được sang replica khác
  (`proxy_next_upstream error timeout http_503`; với 503 chỉ request idempotent như mặc định nginx, cho replica vừa bật
  lại còn đang "nguội" bị pressure limiter từ chối), cắt nhanh kết nối tới IP của replica đã dừng
  (`proxy_connect_timeout 1s`), không loại server sau lỗi (`max_fails=0`) và chọn lại một lần khi chính nginx sinh
  502/504 (`error_page ... @retry`, lúc DNS chưa kịp bỏ IP của replica đã dừng); `stop_grace_period: 30s`.

Thời hạn tắt máy phải lớn hơn khoảng trễ + `SERVER_SHUTDOWN_TIMEOUT` + thời gian đóng kết nối. Request dài hơn
`SERVER_SHUTDOWN_TIMEOUT` (export lớn, chunk TUS chậm) bị cắt khi tắt replica, giống Directus: tăng biến này trong cấu
hình chung nếu cần. Client TUS tiếp tục được từ offset ở instance khác.

## Domain riêng

Dùng khi muốn chạy Backoffice ở một domain khác (ví dụ `backoffice.example.com`) bên cạnh Directus đang phục vụ người
dùng ở domain của nó (ví dụ `cms.example.com`), không chạm vào Deployment, Service, Ingress của Directus. Hai bản dùng
chung DB, Redis, storage và cùng ConfigMap/Secret; thay đổi ở bản này hiện ngay ở bản kia.

Bản Backoffice chỉ đặt riêng **một** biến: `PUBLIC_URL` = URL của domain Backoffice (ngoại lệ Nguyên tắc VIII, đã duyệt
T079). Directus dùng `PUBLIC_URL` cho `Location` của TUS, link share và mời, callback SSO, `<base href>` của app; giữ
giá trị của Directus thì các URL này trỏ sai domain.

- Compose: `docker compose -f docker-compose.yml -f docker-compose.separate-domain.yml up -d --wait` (Directus ở 8090,
  Backoffice ở 8091). Trên `localhost`, cookie không tách theo cổng nên hai bản dùng chung cookie khi dev (vô hại: cùng
  `SECRET`).
- Kubernetes: `helm install ... -f deploy/helm/backoffice/values-separate-domain.yaml` (`domain.publicUrl`, host riêng,
  Directus không mang nhãn pool).

**Cookie domain.** `REFRESH_TOKEN_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN` không bị đặt riêng. Nếu cấu hình chung có đặt
mà giá trị không phủ host Backoffice (ví dụ `cms.example.com` với host `backoffice.example.com`), trình duyệt bỏ cookie
đăng nhập của Backoffice. Chart dừng cài và báo; sửa env Directus: bỏ biến, hoặc đặt domain cha phủ cả hai (ví dụ
`example.com`). Tự kiểm khi không dùng Helm:

```bash
kubectl get configmap,secret <tên> -o yaml | grep COOKIE_DOMAIN
```

**SSO.** IdP phải có callback của domain Backoffice; thêm URL domain Backoffice vào
`AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` (và `AUTH_ALLOWED_PUBLIC_URLS` nếu dùng) trong cấu hình chung: thêm giá trị vào
biến đã có, không thêm biến mới.

**Phiên.** Phiên đăng nhập không chia sẻ giữa hai domain (cookie theo host); cả hai phiên cùng nằm trong
`directus_sessions` và cùng hợp lệ.

**Cache.** Khóa response cache của Directus không chứa host, nên `/server/specs/oas` (URL theo host) đã cache ở domain
này có thể được trả ở domain kia, giống hai bản Directus khác domain dùng chung Redis.

## Kubernetes (`deploy/helm/backoffice`)

Chart tạo Deployment, Service cho BE và FE, Ingress chung một domain, HPA cho BE. Chart không khai báo biến Directus
nào: pod đọc nguyên ConfigMap và Secret mà Deployment Directus đang dùng (`envFrom`; FE chỉ đọc ConfigMap).

```bash
helm install backoffice deploy/helm/backoffice \
  --set directus.configMap=directus-config \
  --set directus.secret=directus-secret \
  --set ingress.host=cms.example.com
```

Không dùng Helm: `helm template ... > manifests.yaml` rồi `kubectl apply -f manifests.yaml` (khi đó không có bước kiểm
cấu hình của chart: tự kiểm theo mục "Ràng buộc khi chạy nhiều instance").

| Value                                                               | Mặc định                    | Ý nghĩa                                                                     |
| ------------------------------------------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| `directus.configMap`, `directus.secret`                             | (bắt buộc)                  | ConfigMap, Secret của Directus                                              |
| `api.autoscaling.*`                                                 | bật, 2–10 replica, CPU 70 % | HPA `autoscaling/v2` (cần metrics-server)                                   |
| `api.shutdownDelaySeconds`, `api.terminationGracePeriodSeconds`     | 10, 30                      | `preStop` và thời hạn tắt máy                                               |
| `apiPool.name`                                                      | tên release                 | nhãn `backoffice.io/api-pool` mà Service của BE chọn                        |
| `uploads.existingClaim`                                             | rỗng                        | PVC `ReadWriteMany` có sẵn cho storage `local`, mount ở `/directus/uploads` |
| `ingress.host`, `.className`, `.tls`, `.annotations`, `.extraPaths` |                             | Ingress                                                                     |
| `domain.publicUrl`                                                  | rỗng                        | chế độ domain riêng: `PUBLIC_URL` của Backoffice                            |

Probe: readiness `/server/health`, liveness và startup `/server/ping` (DB hoặc Redis mất thì pod ra khỏi traffic, không
bị khởi động lại hàng loạt). Pod chạy non-root (BE 1000, FE 1001), không leo quyền, bỏ mọi capability.

**Kiểm cấu hình khi cài.** Khi `helm install`/`upgrade`, chart đọc ConfigMap và Secret của Directus và dừng nếu cấu hình
chỉ an toàn cho một instance (thiếu Redis, `CACHE_STORE`/`RATE_LIMITER_STORE`/`SYNCHRONIZATION_STORE` khác `redis`,
thiếu `SECRET`, SQLite, storage driver `local` không có PVC dùng chung), hoặc, ở chế độ domain riêng, khi cookie domain
không phủ host Backoffice. Thông báo nêu biến, giá trị và giá trị cần đặt trong env Directus. `helm template` và
`--dry-run=client` không đọc được cụm nên bỏ qua bước này.

**Đưa Directus vào pool (chung domain).** Thêm vào pod template của Deployment Directus nhãn
`backoffice.io/api-pool: <apiPool.name>` và `lifecycle.preStop.exec.command: ["sleep", "10"]`, rồi gỡ host đó khỏi
Ingress của Directus (tránh hai Ingress cùng host). Bỏ nhãn để đưa Directus ra khỏi pool.

**Ingress annotation.** Chart không đặt annotation riêng của controller. Upload lớn cần bỏ giới hạn body và không đệm
body; request dài cần timeout đọc đủ lâu (FR-051):

- ingress-nginx: `nginx.ingress.kubernetes.io/proxy-body-size: "0"`,
  `nginx.ingress.kubernetes.io/proxy-request-buffering: "off"`, `nginx.ingress.kubernetes.io/proxy-read-timeout: "300"`.
- Controller khác (Traefik...): đặt giới hạn body, đệm body và timeout đọc tương đương theo tài liệu của controller (CI
  019 chạy Traefik với cấu hình mặc định).

**SAML.** Backoffice không có SAML (D-24 của 003). Hệ thống có user SAML định tuyến login SAML về Directus qua
`ingress.extraPaths`, ví dụ:

```yaml
ingress:
  extraPaths:
    - { path: /auth/login/saml, pathType: Prefix, service: directus, port: 8055 }
```

(`saml` là tên provider trong `AUTH_PROVIDERS`; path này gồm cả callback `/auth/login/saml/acs`.)

## Lệnh CLI

Image Backoffice không có CLI (D-123 của 019). Mọi lệnh CLI chạy bằng image Directus `11.17.4` trên cùng env (cùng DB,
Redis, storage), trong thư mục `/directus` của image:

| Việc                                  | Lệnh                                                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tạo hoặc nâng schema hệ thống         | `node cli.js bootstrap`, `node cli.js database migrate:latest`                                              |
| Tạo user, đổi mật khẩu                | `node cli.js users create --email <e> --password <p> --role <id>`                                           |
|                                       | `node cli.js users passwd --email <e> --password <p>`                                                       |
| Tạo role                              | `node cli.js roles create --role <tên> --admin`                                                             |
| Xóa cache (dùng chung với Backoffice) | `node cli.js cache clear` (`--system` hoặc `--data` để xóa một phần)                                        |
| Đếm item                              | `node cli.js count <collection>`                                                                            |
| Sinh `KEY`, `SECRET`                  | `node cli.js security key:generate`, `node cli.js security secret:generate`                                 |
| Schema snapshot, apply                | `node cli.js schema snapshot <file>`, `node cli.js schema apply <file>` (hoặc API `/schema` của Backoffice) |

Migration là việc của Directus: Backoffice không chạy migration và dừng khi migration của DB khác bản Directus 11.17.4
(D-05 của 001).

Máy dev (`deploy/compose`), qua service `directus` đang chạy:

```bash
docker compose -p bo-deploy exec directus node cli.js users passwd --email admin@example.com --password '<mật khẩu mới>'
```

Kubernetes, qua Deployment Directus đang chạy (đổi tên theo cụm):

```bash
kubectl exec deploy/directus -- node cli.js cache clear
```

Khi không có pod Directus nào chạy, dùng một Pod hoặc Job tạm bằng image `directus/directus:11.17.4` với cùng `envFrom`
(ConfigMap, Secret của Directus) và `command: ["node", "cli.js", ...]`.
