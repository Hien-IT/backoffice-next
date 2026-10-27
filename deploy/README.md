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
[Domain riêng](#domain-riêng) · [Kubernetes](#kubernetes-deployhelmbackoffice) ·
[Chạy độc lập](#chạy-độc-lập-không-directus) · [Lệnh CLI](#lệnh-cli)

## Thay image Directus bằng Backoffice

Trong một service Directus đang chạy (compose hoặc Deployment Kubernetes), chỉ đổi `image:` thành
`hiennd23/backoffice-api:<tag>`. Env, cổng 8055 và probe giữ nguyên; image Backoffice dùng cùng uid/gid 1000, cùng cách
đọc env, `.env`, `CONFIG_PATH`, hậu tố `_FILE`. Thư mục làm việc là `/backoffice` (D-174, owner 2026-10-24), không phải
`/directus`: volume mount của service phải dời theo (`/directus/uploads` → `/backoffice/uploads`, `/directus/database` →
`/backoffice/database`, `/directus/extensions` → `/backoffice/extensions`, `/directus/migrations` →
`/backoffice/migrations`), vì đường dẫn tương đối của env (`STORAGE_LOCAL_ROOT=./uploads`, `EXTENSIONS_PATH`,
`MIGRATIONS_PATH`) tính từ `/backoffice`. Đường dẫn tuyệt đối trong env (ví dụ `DB_FILENAME=/directus/database/x.db`)
thì mount đúng đường đó. Storage S3/MinIO không cần dời gì.

Giới hạn (FR-024):

- Image Backoffice chạy `node cli.js bootstrap` rồi `node cli.js start` như image Directus (021): DB Postgres hoặc
  SQLite trống thì tự cài (seed, 101 migration, admin từ `ADMIN_*`), DB đã cài thì chạy migration còn thiếu.
  MySQL/MariaDB, MSSQL, Oracle, CockroachDB: DB do image Directus cài và migrate, Backoffice bỏ qua bước này (D-145).
  Gặp migration lạ (không thuộc Directus 11.17.4 và không có trong `MIGRATIONS_PATH`) thì `start` dừng và báo version
  nào lệch.
- Đổi image nâng DB lên schema của Directus 11.17.4: mọi node Directus còn chạy trên DB đó phải là 11.17.4.
- Bỏ mọi ghi đè `command`/`args` gọi CLI Directus (ví dụ `npx directus bootstrap && pm2-runtime ...`): CMD của image đã
  làm việc đó. Trên Kubernetes, ghi đè `command` còn bỏ qua `tini` (ENTRYPOINT của image).
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

| Biến                                                                                                      | Giá trị cần                                                | Mặc định Directus                                | Thiếu thì sao                                                                                                                   | Nguồn                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DB_CLIENT` + `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` (hoặc `DB_CONNECTION_STRING`) | cùng một DB thật cho mọi instance                          | image đặt `sqlite3` với file trong container     | mỗi container một DB riêng                                                                                                      | `apps/api/Dockerfile`, `directus/Dockerfile`                                                                 |
| `SECRET`                                                                                                  | một chuỗi cố định, giống nhau ở mọi instance               | không có; mỗi process tự sinh ngẫu nhiên         | token do instance này cấp bị instance kia từ chối                                                                               | `directus/api/src/utils/get-secret.ts:13-18`                                                                 |
| `REDIS` (hoặc `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`...)                                            | trỏ cùng một Redis                                         | không có                                         | bus xóa cache schema/quyền và lock chỉ chạy trong từng process                                                                  | `directus/api/src/bus/lib/use-bus.ts:18`, `lock/lib/use-lock.ts:17`, `redis/utils/redis-config-available.ts` |
| `REDIS_ENABLED` (nếu có đặt)                                                                              | `true`                                                     | không có                                         | có đặt mà khác `true` thì Redis bị tắt dù có `REDIS`                                                                            | như trên                                                                                                     |
| `CACHE_STORE`                                                                                             | `redis`                                                    | `memory`                                         | cache hệ thống và lock cache riêng từng instance (kể cả khi `CACHE_ENABLED=false`)                                              | `directus/api/src/cache.ts:62-84`                                                                            |
| `RATE_LIMITER_STORE`                                                                                      | `redis`                                                    | `memory`                                         | bộ đếm lần đăng nhập (ngưỡng là setting `auth_login_attempts`) đếm riêng từng instance (kể cả khi `RATE_LIMITER_ENABLED=false`) | `directus/api/src/services/authentication.ts:34,137-149`                                                     |
| `SYNCHRONIZATION_STORE`                                                                                   | `redis`                                                    | không có (dùng bộ nhớ process)                   | flow theo lịch, job dọn TUS, retention chạy trên mọi instance                                                                   | `directus/api/src/synchronization.ts:20`                                                                     |
| `STORAGE_LOCATIONS` + `STORAGE_<LOCATION>_DRIVER` và khóa của driver                                      | `s3` (hoặc `local` trên volume `ReadWriteMany` dùng chung) | `local`                                          | mỗi container thấy file khác nhau                                                                                               | Nguyên tắc VII                                                                                               |
| `EXTENSIONS_LOCATION` (spec 020)                                                                          | một location của `STORAGE_LOCATIONS` (vd `s3`)             | không có (đọc `EXTENSIONS_PATH` trong container) | mỗi node nạp bộ extension riêng; cài ở một node, node khác không thấy                                                           | `directus/api/src/extensions/lib/sync/sync.ts`                                                               |

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
grep -E '^(REDIS|CACHE_STORE|RATE_LIMITER_STORE|SYNCHRONIZATION_STORE|SECRET|DB_CLIENT|STORAGE_|EXTENSIONS_LOCATION)' .env
# Kubernetes
kubectl get configmap <tên> -o yaml | grep -E 'REDIS|_STORE|DB_CLIENT|STORAGE_|EXTENSIONS_LOCATION'
kubectl get secret <tên> -o jsonpath='{.data.SECRET}' | base64 -d | wc -c
```

## Extensions (spec 020)

Backoffice nạp cùng extension đã build cho Directus 11.17.4 (trừ `theme`): hook, endpoint, operation chạy trong API mới,
interface, display, layout, module, panel trong app web mới.

- **Nhiều replica**: mọi node, Directus lẫn Backoffice, đặt cùng `EXTENSIONS_PATH` (mặc định `./extensions`) và cùng
  `EXTENSIONS_LOCATION` (vd `s3`, prefix `extensions/` trong bucket). Mỗi node sync từ storage lúc khởi động (pod chỉ
  ready sau khi sync và nạp xong) và khi có thông báo trên kênh bus `extensions.reload`. Chart dừng cài và nâng cấp khi
  nhiều replica (hoặc HPA) mà `EXTENSIONS_LOCATION` rỗng, trừ khi `extensions.inImage=true`.
- **Một máy, không MinIO cho extension**:
  `docker compose -f docker-compose.yml -f docker-compose.shared-extensions.yml up -d --wait` gắn chung volume
  `extensions` vào `/directus/extensions` của Directus và `/backoffice/extensions` của mọi replica Backoffice, để `EXTENSIONS_LOCATION` rỗng (không
  node nào sync, cài/gỡ ghi thẳng vào volume, nạp lại qua bus). Không dùng cho nhiều máy hay Kubernetes.
- **Cài**: Settings > Marketplace của app web mới hoặc của Directus app (cùng bảng `directus_extensions`, cùng storage);
  cài ở một node thì node khác thấy trong vài giây.
- **Nguồn `module`**: khai báo gói extension trong `dependencies` của `apps/api/package.json`, build lại image API.
- **Đóng sẵn vào image**: image dẫn xuất chép extension vào `/backoffice/extensions`, đặt `extensions.inImage=true`, không
  dùng marketplace (bản cài sẽ không tới các pod khác).
- **Nâng cấp từ 019**: đặt `EXTENSIONS_LOCATION` trong ConfigMap/`.env` dùng chung (hoặc `extensions.inImage=true`)
  trước `helm upgrade`; compose: thêm `EXTENSIONS_LOCATION=s3` vào `.env`.
- **Load balancer**: `/extensions/sources/*` (chunk app extension) chỉ tới Backoffice (`bo_pool` ở compose, Service
  `<release>-api-only` ở Helm): chunk của app web mới giữ bare specifier cho import map (D-137), chunk của Directus thì
  không.
- **Extension làm crash**: tắt nó rồi khởi động lại các node:
  `UPDATE directus_extensions SET enabled = false WHERE folder = '<thư mục>';` (hoặc xóa thư mục trên storage), rồi
  `kubectl rollout restart deployment/<release>-api` / `docker compose up -d --force-recreate backoffice-api directus`.
- **Node lệch bộ extension** (một node lỡ thông báo reload, R-65): `PATCH` bật tắt một extension bất kỳ (mọi node sync
  lại) hoặc rollout restart.
- Không bật `EXTENSIONS_AUTO_RELOAD` khi chạy nhiều instance (theo dõi thư mục cục bộ, không qua storage chung); mỗi
  container một process (khóa sync theo máy).

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
| `uploads.existingClaim`                                             | rỗng                        | PVC `ReadWriteMany` có sẵn cho storage `local`, mount ở `/backoffice/uploads` |
| `ingress.host`, `.className`, `.tls`, `.annotations`, `.extraPaths` |                             | Ingress                                                                     |
| `domain.publicUrl`                                                  | rỗng                        | chế độ domain riêng: `PUBLIC_URL` của Backoffice                            |
| `mode`                                                              | `shared`                    | `shared` (cạnh Directus) hay `standalone` (mục "Chạy độc lập")              |
| `migrations.configMap`                                              | rỗng                        | ConfigMap custom migration, mount ở `/backoffice/migrations`                |
| `bootstrap.backoffLimit`, `.activeDeadlineSeconds`, `.resources`    | 3, 600, `api.resources`     | Job `bootstrap` của chế độ `standalone`                                     |

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

**Lọc theo path trong field json (spec 023).** Chỉ API Backoffice nhận key `json(field, path[, type])` trong filter
(Postgres, SQLite; vendor khác 400). Ở chế độ chung domain (pool có Directus: `api_pool` ở compose, Service `-api` ở
Helm) request có json path rơi vào Directus nhận 403 `FORBIDDEN` (D-184), không định tuyến riêng ở lb; trang Content của
app web mới hiện lỗi API như khi `/items` lỗi. Chế độ domain riêng và standalone (pool chỉ có Backoffice) không bị ảnh
hưởng. Bookmark có json path lưu trong `directus_presets` dùng chung; Directus app mở bookmark đó cũng nhận 403 (D-184.1).

**Cài đặt tìm kiếm, Import, Export của collection chặn cả API (spec 024).** Tắt `bo_show_search`, `bo_show_import` hay
`bo_show_export` (Settings > Data Model, card "Content: Search, Import, Export") thì API Backoffice trả 403 `FORBIDDEN`
(câu của lỗi quyền collection) cho tìm kiếm, import, export trên collection đó, với mọi người gọi kể cả admin (D-188).
Directus 11.17.4 không đọc ba cài đặt này: ở chế độ chung domain request rơi vào Directus vẫn được trả lời, không định
tuyến riêng ở lb; muốn chặn đủ thì dùng domain riêng hoặc standalone. Lưu cài đặt ở app nào cũng có tác dụng ngay trên
mọi replica Backoffice (bus `schemaChanged`); sửa thẳng bằng SQL thì gọi `POST /utils/cache/clear` (hoặc
`node cli.js cache clear`).

**Ingress annotation.** Chart không đặt annotation riêng của controller. Upload lớn cần bỏ giới hạn body và không đệm
body; request dài cần timeout đọc đủ lâu (FR-051):

- ingress-nginx: `nginx.ingress.kubernetes.io/proxy-body-size: "0"`,
  `nginx.ingress.kubernetes.io/proxy-request-buffering: "off"`, `nginx.ingress.kubernetes.io/proxy-read-timeout: "300"`.
- Controller khác (Traefik...): đặt giới hạn body, đệm body và timeout đọc tương đương theo tài liệu của controller.
- Keep-alive tới pod: API (như Directus) đóng kết nối rảnh sau 5 s (`keepAliveTimeout` mặc định của Node). Controller
  giữ kết nối rảnh lâu hơn có thể hiếm khi trả 502 khi dùng lại đúng kết nối pod đang đóng; đặt idle timeout phía
  controller dưới 5 s: Traefik `--serverstransport.forwardingtimeouts.idleconntimeout=4s` (CI kind dùng giá trị này),
  ingress-nginx `upstream-keepalive-timeout: "4"` trong ConfigMap của controller.

**SAML.** Backoffice không có SAML (D-24 của 003). Hệ thống có user SAML định tuyến login SAML về Directus qua
`ingress.extraPaths`, ví dụ:

```yaml
ingress:
  extraPaths:
    - { path: /auth/login/saml, pathType: Prefix, service: directus, port: 8055 }
```

(`saml` là tên provider trong `AUTH_PROVIDERS`; path này gồm cả callback `/auth/login/saml/acs`.)

## Chạy độc lập (không Directus)

Từ 021, Backoffice tự cài DB và chạy migration như Directus 11.17.4, nên chạy được một mình. DB vẫn dùng được với
Directus 11.17.4 (từ 022 có thêm migration riêng của Backoffice, xem mục dưới). Chỉ Postgres và SQLite (D-145); vendor khác cần image
Directus để cài và migrate. Chạy `bootstrap` ở **một** nơi (service một lần của compose, Job của Helm); các replica chỉ
`start`.

Không có khi chạy một mình (ngoài phạm vi, Nguyên tắc XI): gửi email (log thay vì gửi), WebSocket và realtime, SAML,
storage ngoài Local/S3, AI/MCP, deployment module, visual editing, telemetry.

**Compose** (Docker Compose ≥ 2.24.4, file override dùng `!override`):

```bash
cd deploy/compose
./init-env.sh
BACKOFFICE_REPLICAS=3 docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --wait
```

- Thứ tự: Postgres, Redis, MinIO healthy → service `bootstrap` (`node cli.js bootstrap`, cùng `.env`) thoát mã 0 → các
  replica `backoffice-api` (`node cli.js start`), FE → lb (cổng 8090, pool chỉ có replica Backoffice). Không có
  cổng 8095. Admin: `ADMIN_EMAIL`/`ADMIN_PASSWORD` của `.env`, tạo lúc bootstrap DB trống.
- Custom migration: chép file `.js` vào volume `migrations` rồi `up` lại; mỗi lần `up -d` chạy lại `bootstrap`, áp file
  mới đúng một lần:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.standalone.yml cp 20990101A-my-change.js bootstrap:/backoffice/migrations/
  docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --wait
  ```

  Compose không khởi động lại replica đang chạy: chúng tiếp tục phục vụ, cache bị xóa sau migration. Muốn khởi động lại:
  `up -d --wait --no-deps --force-recreate backoffice-api`.

- Scale: `up -d --wait --no-deps --scale backoffice-api=<n> backoffice-api` (thiếu `--no-deps` thì `bootstrap` chạy lại,
  vô hại nhưng thừa).
- `bootstrap` lỗi (DB không tới được sau 5 lần × 5 giây, migration ném lỗi): `up --wait` thoát mã khác 0 với
  `service "bootstrap" didn't complete successfully`; replica đang chạy giữ nguyên. Xem
  `docker compose ... logs bootstrap`.
- SQLite: mount volume cho `/backoffice/database` (và `DB_FILENAME` trong đó), nếu không DB mất khi container bị xóa.

**Kubernetes** (`mode: standalone`):

```bash
kubectl create configmap migrations --from-file=migrations/   # tùy chọn: custom migration
helm install backoffice deploy/helm/backoffice \
  --set mode=standalone \
  --set directus.configMap=backoffice-config \
  --set directus.secret=backoffice-secret \
  --set migrations.configMap=migrations \
  --set ingress.host=backoffice.example.com
```

- ConfigMap và Secret env (cùng biến như Directus) phải có trước `helm install`; thiếu thì chart dừng và nêu tên.
- Job `<release>-bootstrap` (hook `pre-install,pre-upgrade`) chạy `node cli.js bootstrap` một lần, Helm chờ nó xong rồi
  mới tạo hoặc cập nhật Deployment; pod chỉ chạy `start`. Job lỗi: `helm install` lỗi (release `failed`, không có
  Deployment), `helm upgrade` lỗi (release và pod đang chạy giữ nguyên); log: `kubectl logs job/<release>-bootstrap`.
- Đổi ConfigMap migration thì chạy `helm upgrade` ngay: pod mới (HPA) thấy file chưa chạy sẽ dừng ở `start` (migration
  lệch). `MIGRATIONS_PATH` để trống hoặc `./migrations` (chart kiểm).
- Không cần ConfigMap, Secret hay PVC của Directus; không gắn nhãn pool cho Directus.

**Chế độ chung** (`mode: shared`, compose mặc định): replica Backoffice chạy CMD của image (`bootstrap` rồi `start`) như
container Directus. DB phải do Directus bootstrap trước (019); N replica (và các container Directus) có thể cùng áp một
custom migration mới, như N container Directus: thêm custom migration khi chỉ một instance đang chạy, hoặc dùng chế độ
độc lập.

**Phục hồi khi lỗi** (như Directus, FR-015):

- DB cài dở (bootstrap dừng giữa seed hay migration hệ thống): `bootstrap` lần sau thấy `directus_collections` và chỉ
  chạy migration, có thể lỗi tiếp. Xóa và tạo lại DB (DB mới), hoặc khôi phục bản sao lưu, rồi chạy lại.
- Migration hệ thống lỗi giữa chừng trên DB đang dùng: khôi phục bản sao lưu trước khi đổi image; không sửa tay
  `directus_migrations`.
- Custom migration lỗi: các migration trước nó đã áp (mỗi file một hàng `directus_migrations`); sửa hoặc bỏ file lỗi rồi
  chạy lại `bootstrap` (compose `up -d`, Helm `upgrade`).
- Helm `install` lỗi: sửa nguyên nhân (DB, env, migration), `helm uninstall`, rồi `helm install` lại.
- `database migrate:down` với migration hệ thống làm DB không còn khớp Directus 11.17.4 (`start` dừng); chỉ dùng cho
  custom migration.
- `init` ghi đè `.env` có sẵn trong thư mục đang chạy.

## Migration riêng của Backoffice (spec 022)

Backoffice có migration riêng (constitution 3.2.0), ghi trong bảng `backoffice_migrations`, không bao giờ trong
`directus_migrations`. Migration đầu tiên `20261026A` thêm `bo_show_search`, `bo_show_import`, `bo_show_export` (boolean,
mặc định `true`) vào `directus_collections` và ba dòng `directus_fields` để form collection có nhãn en-US/vi-VN.

- **Không cần làm gì:** `bootstrap` (CMD của image, Job Helm, service `bootstrap` của compose) chạy migration Directus
  (Postgres, SQLite) rồi migration riêng còn thiếu, trên **mọi** vendor. Vendor khác Postgres và SQLite: chỉ chạy khi DB
  đã được Directus migrate đủ; nếu chưa, `start` dừng với `Missing migrations` của Directus như trước.
- **Nhiều replica cùng lúc:** chạy dưới khóa Redis `backoffice-migrations` (namespace `REDIS_LOCK_NAMESPACE`); không có
  Redis hoặc khác namespace thì mỗi bước vẫn chịu được việc process khác làm trước (bảng, cột, dòng đã có không lỗi;
  dòng `directus_fields` trùng bị xóa, giữ dòng đầu).
- **`start` thiếu migration riêng:** dừng với `Backoffice migrations do not match.` và `Missing Backoffice migrations
  (not run yet): …`; chạy `node cli.js bootstrap` (hoặc khởi động lại container). Dòng lạ (DB của bản Backoffice mới hơn)
  cũng dừng: dùng image mới hơn.
- **Không có lệnh CLI riêng, không có down.** Gỡ tay khi cần (Postgres):

  ```sql
  ALTER TABLE directus_collections DROP COLUMN bo_show_search, DROP COLUMN bo_show_import, DROP COLUMN bo_show_export;
  DELETE FROM directus_fields WHERE collection = 'directus_collections' AND field IN ('bo_show_search', 'bo_show_import', 'bo_show_export');
  DELETE FROM backoffice_migrations WHERE version = '20261026A';
  ```

  rồi `node cli.js cache clear --system`. Bản Backoffice có migration này sẽ chạy lại nó ở `bootstrap` sau.
- **Directus chạy chung:** không cần file, biến môi trường hay cấu hình mới; `migrate:latest|up|down` của Directus không
  đổi. Directus app thấy ba cài đặt trong form collection (không có tác dụng ở Content của Directus app) và bảng
  `backoffice_migrations` trong nhóm bảng chưa quản lý (admin). Backoffice coi bảng này là collection hệ thống (ẩn, 403 ở
  `/items`, không có trong GraphQL và OAS: D-181). Muốn Directus app cũng không thấy bảng: thêm `backoffice_migrations`
  vào `DB_EXCLUDE_TABLES` của **cả hai** app, giữ hai bảng mặc định
  (`spatial_ref_sys,sysdiagrams,backoffice_migrations`; tùy chọn).
- **Nâng Directus lên bản sau 11.17.4:** trước khi ghim bản mới, `grep -rn "bo_\|backoffice_"
  directus/api/src/database/migrations` phải rỗng (tên cột hay bảng trùng sẽ làm migration của một bên lỗi).

## Lệnh CLI

Image Backoffice có CLI của Directus 11.17.4 (021): cùng lệnh, option, log và mã thoát, tên chương trình `backoffice`
(D-147). Chạy `node cli.js <lệnh>` trong thư mục `/backoffice` của image (D-174), trên cùng env với API (cùng DB, Redis, storage):

| Việc                                | Lệnh                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Tạo hoặc nâng schema hệ thống       | `node cli.js bootstrap [--skipAdminInit]`, `node cli.js database install`                                                          |
| Migration                           | `node cli.js database migrate:latest`, `migrate:up`, `migrate:down` (gồm custom migration ở `MIGRATIONS_PATH`)                     |
| Tạo user, đổi mật khẩu              | `node cli.js users create --email <e> --password <p> --role <id>`                                                                  |
|                                     | `node cli.js users passwd --email <e> --password <p>`                                                                              |
| Tạo role                            | `node cli.js roles create --role <tên> [--admin] [--app]`                                                                          |
| Xóa cache (dùng chung với Directus) | `node cli.js cache clear` (`--system` hoặc `--data` để xóa một phần; chỉ khi `CACHE_STORE=redis`)                                  |
| Đếm item                            | `node cli.js count <collection>`                                                                                                   |
| Sinh `KEY`, `SECRET`                | `node cli.js security key:generate`, `node cli.js security secret:generate`                                                        |
| Schema snapshot, apply              | `node cli.js schema snapshot [file] [--format json\|yaml] [-y]`, `node cli.js schema apply <file> [-d] [-y] [--ignoreRules <...>]` |
| Tạo project mới (hỏi đáp)           | `node cli.js init` (chỉ PostgreSQL và SQLite, không cài driver: D-146)                                                             |

Vendor khác Postgres và SQLite: `bootstrap`, `database install`, `database migrate:*` dùng image Directus `11.17.4`
(D-145); các lệnh còn lại chạy được bằng image Backoffice.

`init`: như Directus 11.17.4, migration `20251014A` đọc schema qua DB của env (`DB_*`), không phải DB vừa nhập. Chạy
`init` ở nơi `DB_*` trỏ tới DB đã cài hoặc chính DB sắp tạo (ví dụ `DB_CLIENT=sqlite3 DB_FILENAME=<cùng file>`); env trỏ
tới DB trống thì cả hai app báo `no such table: directus_collections` và hỏi lại.

Máy dev (`deploy/compose`), qua service đang chạy:

```bash
docker compose -p bo-deploy exec backoffice-api node cli.js users passwd --email admin@example.com --password '<mật khẩu mới>'
```

Kubernetes, qua Deployment đang chạy (đổi tên theo cụm):

```bash
kubectl exec deploy/backoffice-api -- node cli.js cache clear
```

Khi không có pod nào chạy, dùng một Pod hoặc Job tạm bằng image Backoffice với cùng `envFrom` và
`args: ["node", "cli.js", ...]` (giữ ENTRYPOINT `tini`).
