# Implementation Plan: Backoffice chạy cạnh Directus chỉ ở domain riêng

**Branch**: `026-separate-domain-only` (trên `main`, không có branch riêng) | **Date**: 2026-10-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/026-separate-domain-only/spec.md`

## Summary

Bỏ chế độ chung domain của 019: khi chạy cạnh Directus (chung DB, Redis, storage), Backoffice chỉ ở domain riêng với
pool API gồm replica BE; Directus giữ domain, `/admin`, Deployment, Service, Ingress của nó. Chế độ domain riêng của
019 (US9) trở thành bố cục mặc định của `deploy/compose` (một `lb` nghe hai cổng: 8090 Directus, 8091 Backoffice) và của
chart `mode: shared` (`domain.publicUrl` bắt buộc, Service `-api` chọn pod BE của release, Ingress một host); nhãn pool,
Service `-api-only`, các route riêng của 020/025, override và values domain riêng, lượt CI `separate-domain` bị xóa.
Standalone (021) không đổi. Không đổi code API, web, image; không thêm dependency; không migration.

Cách làm (chi tiết [research.md](./research.md)):

- Compose: `lb/separate-domain.conf` → `lb/shared.conf` làm conf mặc định, `PUBLIC_URL=http://localhost:8091` cho hai service
  Backoffice ngay trong `docker-compose.yml`; override standalone thêm `environment: !reset` và `ports: !override` để
  giữ Backoffice một mình ở 8090 (R1).
- Test deploy: `instances.ts` bỏ `SEPARATE`, thêm `boLbUrl`/`directusLbUrl`/`BO_PUBLIC_URL`; `separate-domain.test.ts` →
  `domains.test.ts` chạy ở lượt mặc định; các test tải qua lb dùng domain B; test gọi thẳng instance không đổi (R2).
- Chart: selector của `-api-only` thành selector của `-api`, xóa `-api-only`, nhãn pool, `apiPool`, ba path Ingress;
  `fail` khi thiếu `domain.publicUrl` đặt trước `lookup`; kiểm cookie FR-076 ở mọi lần `mode: shared` (R3). Kind: host
  `backoffice.test`, Directus qua port-forward, kiểm `generation` của Deployment Directus, pod còn nhãn cũ không nhận
  request, `helm upgrade` không domain dừng (R4).
- CI: job `deploy` 2 lượt; `deploy-k8s` không đổi bước (R5). README: mục "Domain riêng" thành bố cục mặc định, mục
  chuyển đổi, SAML theo Q1, bỏ đoạn pool/route (R6).
- FR-015: lượt quét đủ (R7) không tìm thấy code nào trong `apps/*`, `libs` lệch luồng Directus vì chung domain; chỉ
  định tuyến lb/Ingress (gỡ) và câu chữ ở 003, 004, 014, 020, 021, 023, 024, 025 (ghi chú "(026: ...)" tại chỗ, FR-014)
  cùng một `reason` trong `tests/parity/accepted-differences.ts` (D-189.7). Không có dòng "Gỡ" chạm `apps/*`, nên
  không cần chủ dự án duyệt thêm.

## Technical Context

**Language/Version**: compose YAML (Compose ≥ 2.24.4: `!override`, `!reset`), nginx config, Helm template (Go template,
Sprig `urlParse`), POSIX `sh`; test TypeScript 5.9.3 strict trên Node.js 22 LTS, ESM, pnpm 10.27, Nx 23 (Vitest 3.2.4).

**Primary Dependencies**: đã có: `nginxinc/nginx-unprivileged:1.28.0-alpine`, `directus/directus:11.17.4`, Helm 4.3.0,
kubeconform 0.8.0, kind 0.33.0, chart Traefik 41.6.1, metrics-server v0.9.0 (ghim ở 019 "Kết quả T001"), `autocannon`,
Vitest. Không thêm package npm, không đổi image.

**Storage**: không bảng, cột, khóa Redis, biến env mới.

**Testing**: `pnpm nx run parity-tests:deploy` (compose mặc định, BE 3 replica + 1 Directus, hai domain; lượt
`DEPLOY_MODE=standalone` giữ); `deploy/helm/backoffice/ci/test-template.sh` (lint, kubeconform, check template, chart giả
`fakeLookup`); `ci/kind-test.sh` (kind + Traefik). Job CI `deploy` (2 lượt), `deploy-k8s`.

**Target Platform**: Linux `amd64` container; Kubernetes ≥ 1.29; Docker Engine + Compose v2 ≥ 2.24.4.

**Project Type**: đóng gói triển khai của monorepo đã có; không app Nx mới.

**Performance Goals**: không đổi: 0 request lỗi khi tắt replica dưới tải qua domain B (SC-003, 019 SC-002); replica
mới sẵn sàng < 30 s (019 SC-008). CI `deploy` ngắn hơn một lượt.

**Constraints**: không sửa `directus/`; không đổi code `apps/*`, `libs/*`; chart không chứa biến Directus ngoài
`PUBLIC_URL` (Nguyên tắc VIII 3.3.0); chart không đọc, không sửa tài nguyên Directus (Q6); standalone không đổi hành
vi (FR-011); làm trên `main`, không stage `apps/api/project.json`, `apps/web/project.json`; push theo quy ước phối hợp
với các phiên khác.

**Scale/Scope**: compose 2 file sửa, 1 đổi tên, 2 xóa; chart 8 file sửa (values, 5 template, NOTES, `_checks`), 2 xóa
(`api-only-service.yaml`, `values-separate-domain.yaml`); ci 3 file sửa; test deploy ~11 file sửa, 1 đổi tên; CI 1 file;
README 1; spec ghi chú ở 8 spec cũ + `accepted-differences.ts` 1 dòng; `CLAUDE.md`, `SPECKIT-GUIDE.md`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Check each principle in `.specify/memory/constitution.md` (v3.3.0). Mark PASS, or VIOLATION with
a row in Complexity Tracking.

- [x] I. Không sửa file dưới `directus/`; không port file mới.
- [x] II. Không DDL, không migration Directus hay Backoffice.
- [x] III. API không đổi (không sửa `apps/api`); mọi path của domain B do BE trả như Directus trả ở domain của nó
  (`/extensions/sources`, `/permissions/me`, `/backoffice/*` giữ nội dung D-137, D-189, D-189.6). Khác biệt: không thêm;
  D-189.7 gỡ, ghi chú D-137 bỏ (spec "Khác biệt").
- [x] IV. Trạng thái dùng chung qua DB/Redis như 002–011; token của app này dùng được ở app kia (lý do IV sửa ở 3.3.0);
  test `domains.test.ts` (FR-073 của 019) và `sessions`/`schema` (4 instance gọi thẳng) giữ.
- [x] V. Không endpoint mới hay đổi: không cần parity mới. Test deploy vẫn so với Directus: `/admin/` của domain D là
  Directus app, thay đổi ở domain này thấy ở domain kia, `web-image.test.ts` (CSP FE = Directus) giữ.
- [x] VI. Không app Nx mới; test trong `parity-tests`; chart và compose trong `deploy/`.
- [x] VII. Feature này là bản cài đặt của 3.3.0: cạnh Directus, Backoffice ở domain riêng, pool API chỉ replica BE,
  Directus không vào pool; FE runtime config (`PUBLIC_URL` → `config.json`), storage chung, SIGTERM an toàn, Redis bus
  giữ như 019–021; `bootstrap` ở `mode: shared` vẫn mỗi replica chạy CMD của image (021).
- [x] VIII. Chỉ `PUBLIC_URL` đặt riêng cho bản Backoffice (compose `environment`, chart `domain.publicUrl`), nay là quy
  tắc của 3.3.0: không cần Complexity Tracking (Q2). Chart không khai báo biến nào khác; biến cookie domain chỉ kiểm.
- [x] IX. Tên file, value, nhãn mang tên Backoffice (`lb/shared.conf`, `mode: shared`); giữ cổng, path, tên biến của
  Directus.
- [x] X. Không đổi hiệu năng (không đổi code); log JSON sẵn có; không gửi email; khác biệt D-189.7 gỡ được ghi trong spec
  026 và ghi chú tại 025.
- [x] XI. SAML: chỉ tài liệu (user SAML dùng Directus app ở domain D, Q1); không websocket, không extension mới.
- [x] XII. Không màn hình FE (không áp dụng).

**Re-check sau Phase 1**: không đổi. `contracts/helm-values.md` giữ đúng một value env (`domain.publicUrl`), không map
env tự do; `contracts/compose.md` giữ `.env` nguyên (`PUBLIC_URL` ở `environment` của service). FR-015 (R7): không dòng
"Gỡ" nào chạm `apps/*`.

## Project Structure

### Documentation (this feature)

```text
specs/026-separate-domain-only/
├── plan.md
├── research.md          # R1 compose, R2 test, R3 chart, R4 kind, R5 CI, R6 README, R7 FR-015 (bảng đủ), R8 ghi chú, R9 không đổi, R10 rủi ro
├── data-model.md        # Domain D/B, pool API, bộ cấu hình chung, release, instance
├── quickstart.md
├── contracts/
│   ├── compose.md       # cổng, định tuyến, file, bất biến kiểm được
│   ├── helm-values.md   # values, template, thông báo dừng, ci/
│   └── tests.md         # test deploy theo file, test-template.sh, kind-test.sh, CI
├── checklists/requirements.md
└── tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
deploy/
├── README.md                                  # sửa (R6)
├── compose/
│   ├── docker-compose.yml                     # sửa: lb hai cổng, PUBLIC_URL hai service Backoffice, chú thích
│   ├── docker-compose.standalone.yml          # sửa: lb.ports !override, environment !reset
│   ├── docker-compose.separate-domain.yml     # xóa
│   └── lb/
│       ├── shared.conf                        # đổi tên từ separate-domain.conf, chú thích 026
│       ├── shared-domain.conf                 # xóa
│       └── standalone.conf                    # sửa chú thích dòng 1 (trỏ shared.conf)
└── helm/backoffice/
    ├── values.yaml                            # sửa: bỏ apiPool, domain.publicUrl bắt buộc (shared), comment mode/host/extraPaths
    ├── values-separate-domain.yaml            # xóa
    ├── templates/
    │   ├── _helpers.tpl                       # bỏ backoffice.pool
    │   ├── _checks.tpl                        # fail thiếu domain (trước lookup); FR-076 mọi lần shared; host fallback urlParse
    │   ├── api-deployment.yaml                # bỏ nhãn pool
    │   ├── api-service.yaml                   # selector = backoffice.selector
    │   ├── api-only-service.yaml              # xóa
    │   ├── ingress.yaml                       # bỏ ba path -api-only
    │   └── NOTES.txt                          # shared: domain riêng; bỏ hướng dẫn nhãn pool
    └── ci/
        ├── values-kind.yaml                   # host backoffice.test, domain.publicUrl
        ├── test-template.sh                   # bỏ separate/pool/api-only; thêm check domain bắt buộc, PUBLIC_URL, cookie mọi lần
        └── kind-test.sh                       # host backoffice.test; Directus generation; nhãn cũ; upgrade không domain
tests/parity/
├── accepted-differences.ts                    # D-189.7 reason
└── src/deploy/
    ├── instances.ts                           # bỏ SEPARATE; directusLbUrl, boLbUrl, BO_PUBLIC_URL
    ├── instances.test.ts                      # composeArgs
    ├── domains.test.ts                        # đổi tên từ separate-domain.test.ts; skipIf(STANDALONE)
    ├── smoke.test.ts, compose.test.ts, shutdown.test.ts, extensions.test.ts, backoffice-permissions.test.ts  # boLbUrl
    └── sessions|schema|flows-schedule|tus|backoffice-migrations|web-image|image-swap.test.ts  # bỏ skipIf(SEPARATE)
.github/workflows/ci.yml                       # job deploy: bỏ lượt separate-domain
specs/
├── 003-auth-session/spec.md, 004-permissions/spec.md, 014-content-module/spec.md, 020-extensions/spec.md,
│   021-standalone-init-cli/spec.md, 023-json-path-filter/spec.md, 024-collection-toggles-api/spec.md,
│   025-policy-import-export/spec.md            # ghi chú "(026: ...)" theo bảng R7
CLAUDE.md, SPECKIT-GUIDE.md                    # dòng 019/020/025/026
```

**Structure Decision**: không thư mục mới; mọi thay đổi nằm trong các file 019–025 đã tạo. `deploy/` vẫn là thư mục
thường (không project Nx), test trong `parity-tests` (019 R1).

## Complexity Tracking

Không có vi phạm. Ngoại lệ T079 của 019 (`PUBLIC_URL`) đã thành quy tắc ở 3.3.0 (Q2).
