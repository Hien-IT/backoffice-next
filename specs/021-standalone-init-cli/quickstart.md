# Quickstart: Chạy độc lập (021)

## Một container, không cần Directus

```bash
docker run --rm -p 8055:8055 hiennd23/backoffice-api:latest          # SQLite ở /directus/database, bootstrap rồi start
```

Với Postgres và admin:

```bash
docker run --rm -p 8055:8055 \
  -e DB_CLIENT=pg -e DB_HOST=db -e DB_PORT=5432 -e DB_DATABASE=backoffice -e DB_USER=backoffice -e DB_PASSWORD=... \
  -e SECRET=... -e ADMIN_EMAIL=admin@example.com -e ADMIN_PASSWORD=... \
  hiennd23/backoffice-api:latest
```

Log: `Initializing bootstrap...` → `Installing Backoffice system tables...` → `Running migrations...` → `Applying ...`
×101 → `Setting up first admin role...` → `Adding first admin user...` → `Done` → `Server started at
http://0.0.0.0:8055` (kiểm lượt 1: `/server/ping` 200 sau 7 s, không env).

`init` (hỏi đáp) đọc schema qua DB của env trong migration `20251014A` như Directus: chạy nó ở nơi `DB_*` trỏ tới DB đã
cài hoặc chính DB sắp tạo (`deploy/README.md` mục "Lệnh CLI").

## Lệnh CLI (image Backoffice)

```bash
docker exec <container> node cli.js database migrate:latest
docker exec <container> node cli.js users passwd --email admin@example.com --password '<mới>'
docker exec <container> node cli.js roles create --role Editors --app
docker exec <container> node cli.js schema snapshot /backoffice/uploads/snapshot.yaml
docker exec <container> node cli.js cache clear --system
docker exec <container> node cli.js --version
```

Custom migration: đặt file `<version>-<ten>.js` vào `MIGRATIONS_PATH` (`/backoffice/migrations` từ D-174 của 019; trước là `/directus/migrations`), rồi `database
migrate:latest` hoặc khởi động lại container (`bootstrap` chạy `latest`).

## Compose chế độ độc lập (máy dev)

```bash
cd deploy/compose
./init-env.sh
docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --wait     # bootstrap ×1, BE ×2, FE, lb
BACKOFFICE_REPLICAS=3 docker compose -f docker-compose.yml -f docker-compose.standalone.yml up -d --wait
```

- App: http://localhost:8090/admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD` trong `.env`). Không có container Directus.
- Thêm migration: `docker compose -f docker-compose.yml -f docker-compose.standalone.yml cp ./20990101A-x.js
  bootstrap:/backoffice/migrations/` rồi `up -d --wait` lại: `bootstrap` chạy lại, replica đang chạy giữ nguyên.
- Scale: `up -d --wait --no-deps --scale backoffice-api=<n> backoffice-api`.
- Chế độ chung của 019 không đổi: `docker compose up -d --wait`.

## Helm chế độ độc lập

```bash
kubectl create configmap backoffice-config --from-env-file=env.txt            # DB_*, REDIS, CACHE_*, STORAGE_*...
kubectl create secret generic backoffice-secret --from-env-file=secret.txt    # SECRET, DB_PASSWORD, ADMIN_PASSWORD...
kubectl create configmap migrations --from-file=./migrations/                 # tùy chọn
helm install bo deploy/helm/backoffice --set mode=standalone \
  --set directus.configMap=backoffice-config --set directus.secret=backoffice-secret \
  --set migrations.configMap=migrations --set ingress.host=bo.example.com --wait
```

- Job `bo-bootstrap` chạy trước Deployment; `kubectl logs job/bo-bootstrap`.
- Thêm migration: cập nhật ConfigMap `migrations` rồi `helm upgrade bo ...` ngay: Job chạy lại và áp file mới; pod chỉ
  roll khi template đổi.

## Vendor ngoài Postgres và SQLite

`bootstrap`, `database install`, `database migrate:*` dừng với thông báo D-145; khởi tạo và migrate bằng image Directus
11.17.4 (`deploy/README.md` mục "Lệnh CLI"); Backoffice `start` như trước.

## Test

```bash
pnpm nx run api:container
cd tests/parity && node scripts/env.mjs up --vendor=postgres --profiles=bootstrap
pnpm nx run parity-tests:parity -- src/bootstrap            # schema, cross, cli, init
node scripts/env.mjs down --vendor=postgres                  # cổng của hai vendor trùng nhau
node scripts/env.mjs up --vendor=sqlite3 --profiles=bootstrap && TEST_DB=sqlite3 pnpm nx run parity-tests:parity -- src/bootstrap
DEPLOY_MODE=standalone pnpm nx run parity-tests:deploy
deploy/helm/backoffice/ci/test-template.sh
```

Unit: `cd apps/api && nice pnpm exec vitest run src/database/migrations src/database/seeds src/cli --maxWorkers=1`.
