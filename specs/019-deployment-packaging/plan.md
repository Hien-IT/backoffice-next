# Implementation Plan: Đóng gói triển khai

**Branch**: `019-deployment-packaging` (trên `main`, không có branch riêng) | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-deployment-packaging/spec.md`

## Summary

Hoàn thiện hai image đã có (FE nginx từ 012, BE từ 001) và thêm ba thứ: `deploy/compose` (Directus 11.17.4, BE N
replica, FE, Postgres, Redis, MinIO, load balancer nginx), `deploy/helm/backoffice` (Deployment, Service, Ingress, HPA,
dùng nguyên ConfigMap/Secret của Directus), và bộ test chấp nhận `tests/parity/src/deploy` chạy với BE 3 replica cộng 1
Directus. Hai chế độ: chung domain (mặc định; `/admin` vào FE, còn lại vào pool gồm BE và Directus, Q1: A) và domain
riêng (US9; Backoffice ở domain khác, chỉ đặt riêng `PUBLIC_URL`; cookie domain có sẵn mà không phủ domain mới thì chart dừng cài và báo để sửa env Directus, FR-076).

Cách làm:

- Không đổi code API. Trình tự tắt máy của 001 giữ nguyên; khoảng trễ trước SIGTERM nằm ở `preStop` (Kubernetes) và retry
  lỗi kết nối của nginx (compose) (R4, D-122).
- FE: `/admin` trả `index.html`, header cache như Directus, CSP sinh từ env lúc khởi động bằng `sh` + `awk` trong
  `40-config.sh`, so trực tiếp với header Directus (R2).
- Readiness `/server/health`, liveness và startup `/server/ping` (Q2: A).
- Test: bảy file Vitest gọi thẳng từng instance (cổng ngẫu nhiên qua `docker compose port`) và qua load balancer; một job
  kind cài chart, rolling restart dưới tải (R9). Hai job CI mới vào cổng `publish` (R11).

Chi tiết: [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/),
[quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: Dockerfile, nginx config, POSIX `sh` + `awk`, Helm template (Go template), YAML; test TypeScript
5.9.3 strict trên Node.js 22 LTS, ESM, pnpm 10.27, Nx 23.

**Primary Dependencies**: đã có: `node:22.23.3-alpine3.24` (build và runtime BE), `nginxinc/nginx-unprivileged:1.28.0-alpine`
(FE), `directus/directus:11.17.4`, `postgis/postgis`, `redis:7-alpine`, `cgr.dev/chainguard/minio`, Vitest 3.2.4,
`autocannon`, `ioredis`, `knex`, `pg` (đã có trong devDependencies của `tests/parity`). Thêm (không phải package npm):
`tini` (package Alpine, PID 1 của image BE, FR-026), `nginx-unprivileged` cho `lb` (cùng image FE, FR-025), Helm, kind,
kubeconform, chart Traefik chỉ trong CI (R12, ghim ở T001). Package npm thêm: `@nx-tools/nx-container` 7.3.0
(devDependency root; target `container` build hai image, R13).

**Storage**: không bảng mới, không migration. Compose: volume Postgres, Redis, MinIO; storage `s3` trên MinIO (bucket
tạo bởi `minio-init`). Chart: không lưu gì; tùy chọn PVC có sẵn cho storage `local`.

**Testing**: `pnpm nx run parity-tests:deploy` (Vitest, `tests/parity/vitest.deploy.config.ts`, global-setup dựng
`deploy/compose` với `BACKOFFICE_REPLICAS=3`, chạy hai lượt: chung domain và domain riêng); job `deploy-k8s`: `helm lint`,
`helm template | kubeconform -strict`, cụm kind; test sh của `40-config.sh` qua `web-image.test.ts` (so với Directus).

**Target Platform**: Linux `amd64` containers; Kubernetes ≥ 1.29; Docker Engine với Compose v2 cho dev.

**Project Type**: đóng gói triển khai cho monorepo web (apps/api, apps/web) đã có.

**Performance Goals**: replica mới sẵn sàng < 30 s (SC-008); 0 request lỗi khi tắt replica dưới tải ≥ 5.000 request
(SC-002); không đổi hiệu năng API (không đổi code).

**Constraints**: không biến env mới, không sửa `directus/`, không ghi bảng hệ thống khi khởi động; chart không chứa biến
Directus (trừ FR-071); làm trên `main`, phối hợp push qua phiên 018.

**Scale/Scope**: ~25 file mới (compose 6, chart 12, test 9) và 4 file sửa (`apps/web/nginx.conf`,
`apps/web/docker/40-config.sh`, hai Dockerfile), 2 job CI, 1 tài liệu vận hành.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] I. Không sửa file dưới `directus/`; CSP mặc định lấy từ header Directus đo được, ghi nguồn `app.ts:166-195` trong
  comment của `40-config.sh`.
- [x] II. BE không chạy migration; DB chỉ được Directus bootstrap (chính Directus làm, như hiện nay ở
  `dev/directus-reference`).
- [x] III. Không đổi API; khác biệt D-120..D-122 ghi trong spec (vị trí phục vụ `/admin`, image, khoảng trễ ở cấu hình);
  tech lead duyệt ở T005 (Nguyên tắc X).
- [x] IV. Mọi trạng thái dùng chung qua DB/Redis như 002–011; test US3–US5 kiểm lại với 4 instance.
- [x] V. Có test so với Directus: CSP và header `/admin` (FE vs Directus), các test đa instance chạy cả trên Directus.
- [x] VI. Không thêm app Nx; test nằm trong project `parity-tests` sẵn có.
- [x] VII. Trọng tâm feature: FE runtime config, nhiều replica, storage dùng chung (S3/PVC RWX), khởi động chỉ đọc, SIGTERM
  an toàn, chung domain. Redis bắt buộc cho cache, rate limiter, lock flow theo lịch: compose đặt `CACHE_STORE`,
  `RATE_LIMITER_STORE`, `SYNCHRONIZATION_STORE` là `redis`; chart dừng cài khi cấu hình chung thiếu (FR-053).
- [x] VIII. Ngoại lệ đã duyệt (T079, 2026-10-20): chế độ domain riêng đặt riêng `PUBLIC_URL` — xem Complexity
  Tracking. Chế độ chung domain: không biến nào.
- [x] IX. Image, chart, nhãn mang tên Backoffice; giữ cổng, path, tên biến của Directus.
- [x] X. Không đổi hiệu năng; log của compose/chart là log JSON sẵn có; không gửi email.
- [x] XI. SAML chỉ ghi định tuyến về Directus (FR-052); không websocket, extension.
- [x] XII. Không có màn hình mới (không áp dụng).

**Re-check sau Phase 1**: không đổi; ngoại lệ VIII chỉ là `PUBLIC_URL` (chart có một value `domain.publicUrl`, không có
map env tự do: contracts/helm-values.md); biến cookie domain không ghi đè, chỉ kiểm và báo (FR-076).

## Project Structure

### Documentation (this feature)

```text
specs/019-deployment-packaging/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── images.md          # FE và BE: cổng, path, user, nhãn, header, CSP, probe
│   ├── compose.md         # service, cổng, env, thứ tự, hai chế độ
│   ├── helm-values.md     # values, tài nguyên sinh ra, nhãn pool, chế độ domain riêng
│   └── tests.md           # test chấp nhận, job CI
├── checklists/requirements.md
└── tasks.md               # /speckit.tasks
```

### Source Code (repository root)

```text
apps/
├── api/Dockerfile                     # sửa: ARG/LABEL phiên bản (R3)
└── web/
    ├── Dockerfile                     # sửa: LABEL; COPY csp mặc định
    ├── nginx.conf                     # sửa: /admin, cache, include csp.inc (R2)
    └── docker/40-config.sh            # sửa: sinh csp.inc từ env (R2)
deploy/
├── README.md                          # vận hành: hai chế độ, đổi image, SIGTERM, Ingress, SAML, CSP, giới hạn
├── compose/
│   ├── docker-compose.yml             # chung domain (mặc định); service Backoffice `platform: linux/amd64`
│   ├── docker-compose.separate-domain.yml
│   ├── .env.example
│   ├── init-env.sh                    # sinh .env với secret ngẫu nhiên
│   └── lb/{shared-domain,separate-domain}.conf
└── helm/backoffice/
    ├── Chart.yaml
    ├── values.yaml
    ├── values-separate-domain.yaml
    ├── templates/{_helpers.tpl,_checks.tpl,api-deployment,api-service,api-hpa,web-deployment,web-service,ingress}.yaml, NOTES.txt
    └── ci/{deps.yaml,values-kind.yaml,test-template.sh,kind-test.sh}  # chỉ cho job deploy-k8s
tests/parity/
├── vitest.deploy.config.ts
├── project.json                       # sửa: target deploy
└── src/
    ├── tus-request.ts                 # tách từ files/tus.test.ts
    └── deploy/{global-setup,instances}.ts, {instances,smoke,compose,sessions,schema,flows-schedule,tus,shutdown,
        image-swap,web-image,separate-domain}.test.ts
.github/workflows/ci.yml               # sửa: job deploy, deploy-k8s; needs của publish
```

**Structure Decision**: `deploy/` là thư mục thường (không phải project Nx) vì chỉ chứa cấu hình; test đặt trong
`tests/parity` để dùng lại helper (R1).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because | Duyệt |
|-----------|------------|-------------------------------------|-------|
| Nguyên tắc VIII: chế độ domain riêng đặt riêng `PUBLIC_URL` | Chủ dự án yêu cầu bản Backoffice ở domain khác (2026-10-20). Directus dùng `PUBLIC_URL` cho `Location` TUS, link mời, share, đặt lại mật khẩu, callback SSO, `<base href>` (R10); giữ giá trị của Directus thì các URL đó trỏ sai domain | Dùng nguyên `PUBLIC_URL` của Directus và CORS: TUS và link vẫn về domain Directus, không đạt US9 kịch bản 3, 5. Map env tự do trong chart: mở đường khai báo lại mọi biến, trái FR-046 | Duyệt (chủ dự án, 2026-10-20, T079) |
