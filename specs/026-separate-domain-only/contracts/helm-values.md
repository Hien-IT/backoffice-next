# Contract: Helm chart `deploy/helm/backoffice` sau 026

## Values

| Value | 019/021 | 026 |
|-------|---------|-----|
| `mode` | `shared` \| `standalone` | giữ tên; comment: `shared` = chạy cạnh Directus, chung DB, Redis, storage, ở domain riêng (Q4) |
| `apiPool.name` | nhãn pool `backoffice.io/api-pool` | **bỏ** (FR-006) |
| `domain.publicUrl` | tùy chọn, "chế độ domain riêng" | **bắt buộc ở `mode: shared`**: `PUBLIC_URL` của domain Backoffice, biến duy nhất bản Backoffice đặt riêng (FR-003, Nguyên tắc VIII 3.3.0); không dùng ở `standalone` (021 FR-083, `PUBLIC_URL` nằm trong ConfigMap Backoffice) |
| `ingress.host` | bắt buộc khi `ingress.enabled` | như cũ; comment: host của domain Backoffice |
| `ingress.extraPaths` | ví dụ SAML về Directus | giữ value (path trước `/admin` và `/` tới Service khác trong namespace), **bỏ ví dụ SAML** (FR-010) |
| `directus.configMap`, `directus.secret`, `api.*`, `web.*`, `uploads.existingClaim`, `extensions.inImage`, `migrations.configMap`, `bootstrap.*`, `ingress.className/tls/annotations` | | không đổi |
| file `values-separate-domain.yaml` | ví dụ domain riêng | **xóa** (Q5); ví dụ values nằm ở `deploy/README.md` |

## Tài nguyên sinh ra (`mode: shared`)

| Template | 026 |
|----------|-----|
| `api-deployment.yaml` | pod template không còn nhãn `backoffice.io/api-pool`; `env: PUBLIC_URL` luôn có (giá trị `domain.publicUrl`); phần còn lại như 019/021 |
| `api-service.yaml` | `selector` = `backoffice.selector` (name, instance, component `api`) — chỉ pod BE của release (FR-006); comment nêu 026 |
| `api-only-service.yaml` | **xóa** (FR-009) |
| `web-deployment.yaml` | `env: PUBLIC_URL` luôn có ở `shared`; không đổi khác |
| `ingress.yaml` | một host (`ingress.host`), path: `extraPaths` (nếu có) → `/admin` (Prefix) → `<release>-web:8080` → `/` (Prefix) → `<release>-api:8055`. Không còn `/extensions/sources`, `/permissions/me`, `/backoffice` (FR-007, FR-009) |
| `_helpers.tpl` | bỏ `backoffice.pool` |
| `_checks.tpl` | (1) `mode: shared` và `domain.publicUrl` rỗng → `fail` ngay, trước `lookup` (nên `helm template` và `--dry-run=client` cũng dừng): thông báo nêu `domain.publicUrl`, `ingress.host` và mục "Kubernetes" / "Chuyển từ chung domain" của `deploy/README.md` (US2 kịch bản 1, US3 kịch bản 1, SC-006). (2) Kiểm cookie domain FR-076 chạy ở mọi lần cài/nâng cấp `mode: shared` (không còn điều kiện `domain.publicUrl`), host so sánh = `ingress.host`, hoặc host của `domain.publicUrl` (`urlParse`) khi Ingress tắt (FR-008). (3) FR-053 giữ nguyên. (4) Chart không đọc, không sửa Deployment Directus (Q6) |
| `NOTES.txt` | `shared`: "Backoffice <version> on <host>: /admin -> <release>-web, the rest -> <release>-api. PUBLIC_URL=<publicUrl> for the Backoffice pods; Directus keeps its own domain and /admin. The database must be bootstrapped by Directus before Backoffice pods start." Bỏ đoạn hướng dẫn gắn nhãn pool. `standalone`: không đổi |
| `api-hpa.yaml`, `web-service.yaml`, `bootstrap-job.yaml`, `Chart.yaml` | không đổi |

## Thông báo dừng (nguyên văn tham chiếu cho test)

- Thiếu domain: `domain.publicUrl is empty: next to Directus (mode: shared) Backoffice runs on its own domain. Set domain.publicUrl (https://backoffice.example.com) and ingress.host (backoffice.example.com); upgrading a shared-domain release of 019: see "Chuyển từ chung domain sang domain riêng" in deploy/README.md.`
- Cookie domain (giữ câu của 019 FR-076): `<VAR>=<value> in <ConfigMap|Secret name> does not cover the Backoffice host <host>: ...`.

## `ci/`

| File | 026 |
|------|-----|
| `values-kind.yaml` | thêm `ingress.host: backoffice.test`, `domain.publicUrl: http://backoffice.test` (Directus trong `deps.yaml` giữ `PUBLIC_URL: http://cms.test`, không có Ingress) |
| `deps.yaml` | không đổi (Directus không nhãn pool, không Ingress) |
| `kind-test.sh` | xem `contracts/tests.md` |
| `test-template.sh` | xem `contracts/tests.md` |
| `values-kind-standalone.yaml`, `deps-standalone.yaml`, `load.mjs` | không đổi (`load.mjs` nhận host làm tham số: gọi với `backoffice.test`) |
