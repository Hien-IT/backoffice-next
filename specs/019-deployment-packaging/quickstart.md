# Quickstart: Đóng gói triển khai (019)

## Máy dev (chỉ cần Docker)

```bash
cd deploy/compose
./init-env.sh                       # tạo .env, secret ngẫu nhiên (không đưa vào git)
docker compose up -d --wait         # Directus, BE ×2, FE, Postgres, Redis, MinIO, lb
```

- App: http://localhost:8090/admin (tài khoản `ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env`).
- Directus gọi thẳng: http://localhost:8095.
- Replica BE: `docker compose port --index 1 backoffice-api 8055`.
- 3 replica: `BACKOFFICE_REPLICAS=3 docker compose up -d --wait`.

Domain riêng (Directus ở 8090, Backoffice ở 8091):

```bash
docker compose -f docker-compose.yml -f docker-compose.separate-domain.yml up -d --wait
```

## Test chấp nhận

```bash
docker build -f apps/api/Dockerfile -t hiennd23/backoffice-api:local .
docker build -f apps/web/Dockerfile -t hiennd23/backoffice-web:local .
pnpm nx run parity-tests:deploy
DEPLOY_MODE=separate-domain pnpm nx run parity-tests:deploy
```

## Kubernetes

Chung domain, dùng ConfigMap/Secret của Directus:

```bash
helm install backoffice deploy/helm/backoffice \
  --set directus.configMap=directus-config \
  --set directus.secret=directus-secret \
  --set ingress.host=cms.example.com
```

Rồi thêm nhãn `backoffice.io/api-pool: backoffice` và `preStop` vào pod Directus nếu muốn Directus vào pool
(contracts/helm-values.md). Domain riêng: `-f deploy/helm/backoffice/values-separate-domain.yaml`.

Thay một instance Directus bằng BE (compose hoặc Deployment có sẵn): chỉ đổi `image:` thành
`hiennd23/backoffice-api:<tag>`; bỏ `command`/`args` nếu có gọi CLI Directus.

## Kiểm nhanh

```bash
curl -s http://localhost:8090/server/health
curl -sI http://localhost:8090/admin | grep -i -E 'content-security-policy|cache-control'
docker compose kill -s TERM backoffice-api   # các replica thoát mã 143, lb chuyển request
```
