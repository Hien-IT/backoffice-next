# Quickstart: Backoffice chạy cạnh Directus chỉ ở domain riêng (026)

Mọi lệnh chạy ở gốc repo trên `main` (không branch). Cần Docker (Compose ≥ 2.24.4), Node 22, pnpm 10; Helm 4.3, kind
0.33, kubeconform 0.8 cho phần chart (phiên bản ghim trong `specs/019-deployment-packaging/research.md` "Kết quả T001").

## 1. Compose dev hai domain (US1)

```bash
cd deploy/compose && ./init-env.sh && docker compose up -d --wait
```

- Directus app: http://localhost:8090/admin (domain D); Backoffice app: http://localhost:8091/admin (domain B); Directus
  gọi thẳng: http://localhost:8095.
- Kiểm định tuyến: `docker compose logs lb | grep server/info` → dòng cổng `8081` chỉ có IP replica `backoffice-api`,
  dòng cổng `8080` chỉ có IP `directus`.
- Kiểm env: `docker compose config --format json | jq '.services["backoffice-api"].environment.PUBLIC_URL'` →
  `http://localhost:8091`; mọi khóa khác bằng `services.directus.environment`.
- 3 replica: `BACKOFFICE_REPLICAS=3 docker compose up -d --wait`.
- Standalone (021, không đổi): `docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --wait` →
  Backoffice ở http://localhost:8090, không có 8091.

## 2. Bộ test chấp nhận (FR-012, SC-002, SC-003)

```bash
pnpm nx run parity-tests:deploy
```

Dựng compose mặc định với `BACKOFFICE_REPLICAS=3`, image `hiennd23/backoffice-{api,web}:local` (build trước bằng
`pnpm nx run-many -t container` hoặc đặt `BACKOFFICE_TAG`). Lượt standalone:

```bash
DEPLOY_MODE=standalone pnpm nx run parity-tests:deploy
```

Không còn `DEPLOY_MODE=separate-domain`.

## 3. Chart (US2)

Kiểm template không cần cụm:

```bash
deploy/helm/backoffice/ci/test-template.sh
```

Cài cạnh Directus (values tối thiểu):

```bash
helm install bo deploy/helm/backoffice \
  --set directus.configMap=directus-config --set directus.secret=directus-secret \
  --set ingress.host=backoffice.example.com --set domain.publicUrl=https://backoffice.example.com
```

- Thiếu `domain.publicUrl` → `helm install`/`upgrade`/`template` dừng, thông báo nêu `domain.publicUrl`, `ingress.host`
  và mục README (US2-1, US3-1).
- Cookie domain trong ConfigMap không phủ host → dừng như FR-076 của 019 (US2-4).
- Kiểm cài: `kubectl get endpoints bo-api` chỉ IP pod `bo-api-*`; `kubectl get deployment directus -o
  jsonpath='{.metadata.generation}'` không đổi trước/sau (SC-004).

Kịch bản kind đầy đủ (routing, tải khi rolling/HPA, extension 020, FR-053, FR-076, nâng cấp không domain, standalone
021):

```bash
kind create cluster --name bo-deploy && KIND_CLUSTER=bo-deploy deploy/helm/backoffice/ci/kind-test.sh
```

## 4. Chuyển một bản chung domain cũ (US3)

Theo mục "Chuyển từ chung domain sang domain riêng" của `deploy/README.md`: đặt DNS cho domain B; thêm `ingress.host`,
`domain.publicUrl`; trả host D về Ingress của Directus; gỡ tay nhãn `backoffice.io/api-pool` khỏi pod template Directus
(tùy chọn); thêm URL domain B vào `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` (và `AUTH_ALLOWED_PUBLIC_URLS`) nếu dùng SSO;
`helm upgrade`; user đăng nhập lại ở domain B. User SAML chỉ dùng Directus app ở domain D (Q1).

## 5. Kiểm SC-001, SC-007 (không còn cấu hình, câu chữ chung domain)

```bash
grep -rniE "shared-domain|api-pool|apiPool|bo-api-only|api_pool.*directus" deploy .github/workflows CLAUDE.md
```

→ chỉ còn: mục "Chuyển từ chung domain" của README (nhãn cũ), check phủ định trong `ci/test-template.sh`, bước giả lập
nhãn cũ (US2-3) và comment US3-1 trong `ci/kind-test.sh`, các dòng CLAUDE.md ghi "removed by 026" (kiểm 2026-10-28).

```bash
for f in specs/0[0-2][0-9]-*/spec.md; do case $f in specs/019-*|specs/026-*) continue;; esac; awk -v F="$f" 'BEGIN{RS=""} /chung domain|shared-domain|rơi vào Directus/ && !/\(026:/ {print F": "substr($0,1,120)}' "$f"; done
```

→ không có kết quả: mọi đoạn (paragraph, bảng) còn nhắc chung domain có ghi chú "(026: ...)" (ghi chú đứng cuối đoạn,
nên kiểm theo đoạn chứ không theo dòng; kiểm 2026-10-28).
