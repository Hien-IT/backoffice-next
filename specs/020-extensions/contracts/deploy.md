# Contract: Triển khai (compose, load balancer, Helm, image)

## 1. Compose dev (`deploy/compose`)

| File | Thay đổi |
|------|----------|
| `.env.example` | `EXTENSIONS_LOCATION=s3` (prefix `extensions/` trong bucket `directus`; `EXTENSIONS_PATH` mặc định) |
| `docker-compose.yml` | service `registry` (fake registry của parity, chỉ profile `extensions-test`) cho acceptance; không volume extension |
| `lb/shared-domain.conf` | `upstream bo_pool { zone bo_pool 64k; server backoffice-api:8055 resolve max_fails=0; }`; `location ^~ /extensions/sources/ { error_page 502 504 = @retry_bo; proxy_pass http://bo_pool; }`; `location @retry_bo { proxy_pass http://bo_pool; }` (cùng proxy settings) |
| `lb/separate-domain.conf` | không đổi |
| `README.md` | mục "Extensions": biến bắt buộc khi nhiều replica (Directus và Backoffice cùng `EXTENSIONS_PATH`, `EXTENSIONS_LOCATION`), cách cài (marketplace), nguồn `module` (khai báo `apps/api/package.json`, build image), đóng sẵn vào image (image dẫn xuất chép vào `/directus/extensions`; không dùng marketplace), "Nâng cấp từ 019" (đặt `EXTENSIONS_LOCATION` hoặc `extensions.inImage=true`), runbook extension làm crash (`UPDATE directus_extensions SET enabled = false WHERE folder = '…'` hoặc xóa thư mục trên storage, rồi rollout restart), node lệch bộ extension (`PATCH` một extension hoặc rollout restart, R-65), không bật `EXTENSIONS_AUTO_RELOAD` khi nhiều instance, một process mỗi container, self-check grep `EXTENSIONS_LOCATION` |

## 2. Helm (`deploy/helm/backoffice`)

| File | Thay đổi |
|------|----------|
| `values.yaml` | `extensions.inImage: false` (true = bỏ kiểm `EXTENSIONS_LOCATION`) |
| `templates/api-only-service.yaml` (mới) | `Service <release>-api-only`, selector `backoffice.selector` + `app.kubernetes.io/component: api` (không nhãn pool), port 8055 |
| `templates/ingress.yaml` | path `/extensions/sources` (Prefix) → `<release>-api-only:8055`, đặt trước `/admin` và `/` |
| `templates/_checks.tpl` | reason mới trong `$reasons` khi `(or .Values.api.autoscaling.enabled (gt (int .Values.api.replicas) 1))` và `EXTENSIONS_LOCATION` rỗng và `not .Values.extensions.inImage`: "EXTENSIONS_LOCATION is empty: with several replicas extensions must come from shared storage (set EXTENSIONS_LOCATION in the Directus ConfigMap) or be baked into the image (extensions.inImage=true)" |
| `templates/NOTES.txt` | dòng `/extensions/sources → api-only`; khi check chặn: thông báo kèm "Nâng cấp từ 019" (README) |
| `ci/deps.yaml` | ConfigMap `EXTENSIONS_LOCATION: s3` |
| `ci/test-template.sh` | `good` thêm `EXTENSIONS_LOCATION`; `expect_fail` thiếu `EXTENSIONS_LOCATION` với HPA bật; `expect_ok` với `extensions.inImage=true` |
| `ci/kind-test.sh` | cài `parity-endpoint-demo` qua Directus pod (fake registry trong cụm, job `registry`), gọi `/parity-endpoint-demo` qua Ingress tới ≥ 3 pod, scale HPA và gọi lại |

Probe không đổi (startup `/server/ping`, readiness `/server/health`, liveness `/server/ping`).

## 3. Image API (`apps/api/Dockerfile`)

- Không đổi cấu trúc: `pnpm deploy --prod` giữ `rollup`, `rolldown`, `@rollup/plugin-*`, `chokidar`, `node-machine-id`,
  `tar`, `fs-extra`, `glob-to-regexp` vì là `dependencies`.
- `dist/extensions` (đã có), `TEMP_PATH=./node_modules/.directus` (`/directus/node_modules/.directus`) thuộc `node`:
  T001 kiểm trong container (`extensions`, `app-extensions`, `marketplace`).
- [Unverified] `rolldown` binding musl: T001.

## 4. Image web (`apps/web/Dockerfile`, `nginx.conf`, `docker/csp.awk`, `40-config.sh`)

- `40-config.sh`: đọc nội dung `<script type="importmap">` trong `/usr/share/nginx/html/admin/index.html`, tính sha256
  base64, truyền cho `csp.awk`.
- `csp.awk`: `script-src` thêm `'sha256-…'` của import map và origin của `PUBLIC_URL` khi là URL tuyệt đối (cross-site);
  không `'unsafe-inline'`; `web-image.test.ts` thêm ca (hash khớp nội dung, origin cross-site).
- Không đổi cache: `/admin/assets/*.entry.js` vẫn `immutable`; `index.html` `no-cache` (import map đổi theo build).
