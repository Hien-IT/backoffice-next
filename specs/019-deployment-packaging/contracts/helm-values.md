# Contract: Helm chart `deploy/helm/backoffice`

## Values

| Key | Mặc định | Ý nghĩa |
|-----|----------|---------|
| `directus.configMap` | (bắt buộc) | tên ConfigMap đang cấp cho Directus; `envFrom` cho BE và FE |
| `directus.secret` | (bắt buộc) | tên Secret đang cấp cho Directus; `envFrom` chỉ cho BE |
| `api.image.repository` / `.tag` / `.pullPolicy` | `hiennd23/backoffice-api` / `appVersion` / `IfNotPresent` | image BE |
| `api.replicas` | 2 | khi `api.autoscaling.enabled=false` |
| `api.autoscaling.enabled` / `.minReplicas` / `.maxReplicas` / `.targetCPUUtilizationPercentage` | `true` / 2 / 10 / 70 | HPA `autoscaling/v2` |
| `api.resources` | requests `cpu: 250m, memory: 512Mi`; limits `memory: 1Gi` | |
| `api.shutdownDelaySeconds` | 10 | `preStop` `sleep` (R4) |
| `api.terminationGracePeriodSeconds` | 30 | ≥ delay + `SERVER_SHUTDOWN_TIMEOUT` + đóng kết nối |
| `apiPool.name` | tên release | giá trị nhãn `backoffice.io/api-pool`; Directus vào pool bằng nhãn này |
| `uploads.existingClaim` | `""` | PVC có sẵn (RWX) mount ở `/directus/uploads` |
| `web.image.repository` / `.tag` | `hiennd23/backoffice-web` / `appVersion` | image FE |
| `web.replicas` | 1 | FE một container theo yêu cầu |
| `web.resources` | requests `cpu: 50m, memory: 64Mi` | |
| `ingress.enabled` / `.className` / `.host` / `.tls` / `.annotations` | `true` / `""` / (bắt buộc) / `[]` / `{}` | |
| `ingress.extraPaths` | `[]` | `{ path, pathType, service, port }`, đặt trước `/`; dùng cho SAML về Directus (FR-052) |
| `domain.publicUrl` | `""` | chế độ domain riêng: đặt `PUBLIC_URL` cho BE và FE |

Không có key nào nhận map env tự do (FR-046, FR-071).

## Kiểm cookie domain (FR-076)

Chỉ khi `domain.publicUrl` khác rỗng và khi cài/nâng cấp thật (Helm `lookup`; `helm template` bỏ qua). Ví dụ thông báo
khi `ingress.host=backoffice.example.com` và ConfigMap `directus-config` có `REFRESH_TOKEN_COOKIE_DOMAIN=cms.example.com`:

```text
Error: REFRESH_TOKEN_COOKIE_DOMAIN="cms.example.com" in ConfigMap directus-config does not cover the Backoffice host
"backoffice.example.com": browsers would drop the Backoffice login cookies. Change the Directus env: remove the variable,
or set a parent domain that covers both hosts (for example "example.com"), then install again.
```

| Giá trị trong cấu hình chung | Host Backoffice | Kết quả |
|------------------------------|-----------------|---------|
| (không đặt) | bất kỳ | cài tiếp |
| `example.com` hoặc `.example.com` | `backoffice.example.com` | cài tiếp (phủ được) |
| `cms.example.com` | `backoffice.example.com` | dừng, báo |
| `backoffice.example.com` | `backoffice.example.com` | cài tiếp (nhưng Directus ở `cms.example.com` mất cookie: không thuộc chart này) |

## Tài nguyên sinh ra

| Tài nguyên | Tên | Ghi chú |
|------------|-----|---------|
| Deployment | `<release>-api` | nhãn pod `app.kubernetes.io/{name,instance,component=api}`, `backoffice.io/api-pool: <apiPool.name>`; `rollingUpdate maxSurge 1, maxUnavailable 0`; `securityContext` `runAsNonRoot`, `runAsUser/runAsGroup/fsGroup 1000`; probe theo contracts/images.md; `preStop` |
| Service | `<release>-api` | ClusterIP 8055, selector chỉ `backoffice.io/api-pool: <apiPool.name>` |
| HorizontalPodAutoscaler | `<release>-api` | khi `api.autoscaling.enabled` |
| Deployment | `<release>-web` | uid 101, probe `/admin/config.json`, `envFrom` chỉ ConfigMap |
| Service | `<release>-web` | ClusterIP 8080 |
| Ingress | `<release>` | `ingress.extraPaths`, rồi `/admin` (Prefix) → web, `/` (Prefix) → api |

`helm template` với values tối thiểu (`directus.configMap`, `directus.secret`, `ingress.host`) phải qua
`kubeconform -strict` cho Kubernetes 1.29.

## Kiểm cấu hình đa instance (FR-053)

Mọi chế độ, khi cài/nâng cấp thật (`lookup`). Đọc ConfigMap `directus.configMap` và Secret `directus.secret` như Directus
đọc env. Lý do dừng:

| Điều kiện | Lý do trong thông báo | Giá trị cần đặt trong env Directus |
|-----------|----------------------|-------------------------------------|
| có `REDIS_ENABLED` mà khác `true`; hoặc không có `REDIS_ENABLED`, không có `REDIS` và không có khóa `REDIS_*` | No Redis configured | `REDIS=redis://...` (hoặc `REDIS_HOST`...) |
| `CACHE_STORE` không đặt hoặc `memory` | CACHE_STORE is "memory" | `CACHE_STORE=redis` |
| `RATE_LIMITER_STORE` không đặt hoặc `memory` | RATE_LIMITER_STORE is "memory" | `RATE_LIMITER_STORE=redis` |
| `SYNCHRONIZATION_STORE` khác `redis` | SYNCHRONIZATION_STORE is not "redis" (scheduled flows run on every instance) | `SYNCHRONIZATION_STORE=redis` |
| không có `SECRET` | SECRET is not set (each instance generates its own: tokens fail across instances) | `SECRET=<chuỗi cố định>` |
| `DB_CLIENT` không đặt hoặc `sqlite3` | DB_CLIENT is "sqlite3" or not set (each container has its own database) | `DB_CLIENT=pg` (hoặc vendor đang dùng) + `DB_*` |
| `STORAGE_LOCATIONS` không đặt hoặc có `local`, và `uploads.existingClaim` rỗng | storage "local" without a shared volume | location `s3`, hoặc đặt `uploads.existingClaim` (PVC RWX) |

Danh sách đầy đủ, gồm biến theo tình huống và khuyến nghị: spec mục "Env Directus bắt buộc khi chạy nhiều instance".

Ví dụ:

```text
Error: ConfigMap directus-config / Secret directus-secret are only safe for a single instance:
  - SYNCHRONIZATION_STORE is not "redis" (scheduled flows run on every instance): set SYNCHRONIZATION_STORE=redis
Change the Directus env, then install again.
```

## Chế độ domain riêng (`values-separate-domain.yaml`)

```yaml
directus: { configMap: directus-config, secret: directus-secret }
ingress: { host: backoffice.example.com }
domain: { publicUrl: https://backoffice.example.com }
apiPool: { name: backoffice-separate }   # Directus không mang nhãn này
```

## Directus vào pool (chế độ chung domain)

Thêm vào pod template của Deployment Directus đang có (không đổi env, image):

```yaml
metadata:
  labels:
    backoffice.io/api-pool: <apiPool.name>
spec:
  terminationGracePeriodSeconds: 30
  containers:
    - name: directus
      lifecycle:
        preStop:
          exec: { command: ["sleep", "10"] }
```

Ingress Directus đang có phải gỡ host đó (hoặc chuyển sang Ingress của chart) để tránh hai Ingress cùng host.
