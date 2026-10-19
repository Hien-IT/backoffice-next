# Contract: test chấp nhận và CI

## `pnpm nx run parity-tests:deploy`

- Config `tests/parity/vitest.deploy.config.ts`: `include: ['src/deploy/**/*.test.ts']`, `globalSetup:
  ['src/deploy/global-setup.ts']`, `fileParallelism: false`, `testTimeout: 120_000`.
- `global-setup.ts`: `init-env.sh` vào thư mục tạm (thêm `AUTH_LOGIN_ATTEMPTS=5`, `TUS_CHUNK_SIZE=1mb`), `docker compose -p
  bo-deploy up -d --wait` với `BACKOFFICE_REPLICAS=3`, `BACKOFFICE_TAG=${BACKOFFICE_TAG:-local}`; teardown `down -v`.
  `DEPLOY_MODE=separate-domain` thêm file override.
- `instances.ts`: danh sách instance `{ name, url }` = 3 replica (`docker compose port --index i backoffice-api 8055`) +
  Directus (`http://127.0.0.1:8095`); `lbUrl`; `container(name)` cho `docker kill`/`inspect`.

| File | Chế độ | Kiểm | Spec |
|------|--------|------|------|
| `sessions.test.ts` | chung | token, cookie, session qua 4 instance; refresh chéo; logout chéo; khóa sau `AUTH_LOGIN_ATTEMPTS` lần sai luân phiên | US3, FR-030 |
| `schema.test.ts` | chung | field mới thấy ngay ở 3 instance còn lại; permission sửa ở Directus có hiệu lực ở BE; response cache không trả bản cũ | US4, FR-063 |
| `flows-schedule.test.ts` | chung | ≥ 10 lượt cron `*/2 * * * * *`, đúng 1 lần mỗi lượt; tắt instance rồi lượt kế vẫn chạy | US5, FR-062 |
| `tus.test.ts` | chung | ≥ 4 chunk xoay vòng 4 instance; SHA-256 trên MinIO; 1 dòng `directus_files`; tiếp tục sau khi tắt instance | US5, FR-061 |
| `shutdown.test.ts` | chung | `autocannon` 60 s qua `lb`; TERM một replica; scale lại 3; 0 lỗi; mã 143; kết nối DB/Redis về 0 | US6, FR-064 |
| `image-swap.test.ts` | chung | container BE với env/mount của `directus`; health, đăng nhập, upload; `docker inspect` env và mount giống | US1, FR-020 |
| `web-image.test.ts` | chung | 2 FE khác `PUBLIC_URL`; deep link; header cache; CSP FE = CSP Directus `/admin` ở 3 bộ env | US8, FR-001..006 |
| `separate-domain.test.ts` | riêng | `Location` TUS ở 8091; link mời theo 8091; sửa ở 8090 thấy ở 8091 và ngược lại; `Set-Cookie` không `Domain`; `config.json` của 8091 | US9, FR-075 |

Mỗi test in số liệu đo (số request, lỗi, thời gian thoát) vào log để SC-001, SC-002 đối chiếu được.

## Job CI (`.github/workflows/ci.yml`)

| Job | needs | Bước | Thời gian ước lượng |
|-----|-------|------|---------------------|
| `deploy` | `docker` | nạp image `:ci`; `parity-tests:deploy` chung domain; rồi `DEPLOY_MODE=separate-domain`; log container khi lỗi | ~15 phút [Inference] |
| `deploy-k8s` | `docker` | `helm lint`; `helm template` (values mặc định tối thiểu và domain riêng) `| kubeconform -strict -kubernetes-version 1.29.0`; kind; `kind load`; Traefik; `ci/deps.yaml`; `helm install -f ci/values-kind.yaml --wait`; probe Ready; curl `/admin/` và `/server/ping` qua Ingress; `rollout restart` BE dưới `autocannon` → 0 lỗi; `kubectl scale` 2→4→2 dưới tải → 0 lỗi | ~15 phút [Inference] |

`publish` thêm `deploy`, `deploy-k8s` vào `needs`.
