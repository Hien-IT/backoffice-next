# Quickstart: Nền tảng workspace và kết nối hệ thống (001)

Hướng dẫn kiểm tra feature 001 trên máy dev, theo đúng tiêu chí chấp nhận của spec: chạy API mới bằng
cấu hình của Directus, cạnh Directus trên cùng DB và Redis; `/server/*` trả về giống nhau; DB không bị
thay đổi.

## 0. Chuẩn bị

- Node 22 (máy dev hiện có Node 24: dùng `nvm use` hoặc `fnm use`, repo có `.nvmrc`).
- pnpm 10.27.0 qua Corepack (máy dev có pnpm 11 toàn cục; Corepack đọc `packageManager` trong
  `package.json`).
- Docker có Compose v2.

```bash
nvm use
```

```bash
corepack enable
```

```bash
pnpm install
```

Lần đầu: tạo file env của môi trường tham chiếu (`.env` bị `.gitignore` bỏ qua):

```bash
cp dev/directus-reference/.env.example dev/directus-reference/.env
```

## 1. Build, lint, test toàn workspace

```bash
pnpm nx run-many -t lint typecheck test build
```

Mong đợi: tất cả đạt; coverage `apps/api` và libs BE ≥ 80%, `apps/web` ≥ 60% (in ở cuối mỗi project).

## 2. Bật Directus tham chiếu

```bash
docker compose -f dev/directus-reference/docker-compose.yml up -d --wait
```

Directus 11.17.4 chạy ở `http://localhost:8055`, cùng Postgres (PostGIS), Redis, MinIO. Môi trường này dùng
Postgres 16, ngoài danh sách phiên bản cam kết (spec, Assumptions); chỉ để thử bằng tay. Cổng kiểm tra là bộ
test đối chiếu ở §5 (Postgres 13).

## 3. Chạy API mới bằng đúng cấu hình của Directus

Trong `dev/directus-reference/docker-compose.yml`, khối biến môi trường của Directus là một YAML anchor
(`x-directus-environment`). Service `backoffice-api` (profile `backoffice`) dùng **cùng anchor đó**,
chỉ khác image và cổng ngoài (8056).

```bash
docker compose -f dev/directus-reference/docker-compose.yml --profile backoffice up -d --build --wait backoffice-api
```

Mong đợi trong log (`docker compose ... logs backoffice-api`): dòng phiên bản, cảnh báo biến chưa hỗ
trợ (nếu có), `Server started at http://0.0.0.0:8055`. Không có dòng lỗi.

Khi phát triển có thể chạy API trực tiếp trên máy bằng `pnpm nx serve api` với cùng các biến trong anchor
đó, chỉ đổi `DB_HOST=localhost`, `REDIS=redis://localhost:6379`,
`STORAGE_S3_ENDPOINT=http://localhost:9000`, `PORT=8056`. Cách này chỉ để dev; tiêu chí "cùng cấu hình"
được kiểm bằng service container ở trên.

## 4. So sánh nhanh bằng tay

```bash
curl -si localhost:8055/server/info
```

```bash
curl -si localhost:8056/server/info
```

Mong đợi: cùng status, cùng body; header `X-Powered-By` là `Directus` và `Backoffice`. Làm tương tự với
`/server/ping`, `/server/health`, `/server/specs/oas`. Ở OAS còn khác: `info.version` và `ETag` (hash theo thời
điểm request), chữ `Backoffice` trong mô tả (D-02), thứ tự `tags`, `paths` có thể khác (FR-105).

## 5. Chạy bộ test đối chiếu

Bộ test tự dựng môi trường riêng (DB, Redis, MinIO, Directus, API mới) bằng
`tests/parity/docker-compose.yml`, cả hai app đọc cùng file `tests/parity/env/<vendor>.env`. Bộ test KHÔNG
dùng `dev/directus-reference` (môi trường §2–§4 chỉ để thử bằng tay), vì `db-unchanged`, `redis-down` dừng
container.

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics
```

```bash
PARITY_SUITE=full pnpm nx run parity-tests:parity --vendor=postgres
```

```bash
pnpm nx run parity-tests:env-down --vendor=postgres
```

`parity-tests:test` chỉ chạy unit test của bộ so sánh, không cần Docker (nằm trong §1). `--vendor` đặt
`TEST_DB` và thắng biến `TEST_DB` có sẵn. Bộ full cần bốn profile này (giống job
parity postgres+full của CI); bộ reduced không cần. Mỗi profile là một cặp Directus + API mới riêng (cổng
riêng), không đổi env của cặp chính.

`--vendor` (hoặc `TEST_DB`) nhận `postgres`, `postgres10`, `mysql`, `mysql5`, `maria`, `sqlite3`, `mssql`,
`oracle`, `cockroachdb`.
`PARITY_SUITE=reduced` chạy bộ rút gọn (ping, health, info, lỗi 404 và payload, `methods`, `conditional`);
`full` chạy mọi test đối chiếu (FR-102, T082).

Mong đợi: mọi test đạt. Khi có khác biệt chưa được chấp nhận, test in endpoint, vị trí (header hoặc
JSON pointer) và giá trị hai bên.

## 6. Kiểm tra DB không bị thay đổi

Nằm trong `PARITY_SUITE=full` (file `tests/parity/src/db-unchanged.test.ts`): dừng mọi container Directus (kể cả của profile), chụp
schema và checksum dữ liệu mọi bảng (cả `directus_*` lẫn bảng người dùng), chạy API mới, gửi toàn bộ request của bộ test, gửi
`SIGTERM`, chụp lại và so sánh. Mong đợi: hai bản chụp giống hệt. `readonly-account.test.ts` gửi cùng bộ request (`request-set.ts`) dưới một role Postgres
chỉ có SELECT, kiểm không có `500` và không có lỗi quyền (FR-024).

## 7. Kiểm tra dừng khi migration lệch

Nằm trong `PARITY_SUITE=full` (file `tests/parity/src/startup/startup.test.ts`): tạo DB tạm từ DB đã migrate,
xóa hoặc thêm dòng trong `directus_migrations` của DB tạm, chạy API mới và kiểm tra mã thoát 1 cùng dòng
log liệt kê version thiếu/thừa (contract: [startup.md](./contracts/startup.md)).

Các kịch bản khởi động khác trong cùng file: migration tùy biến hợp lệ (ở `MIGRATIONS_PATH` và
`EXTENSIONS_PATH/migrations`), cổng bị chiếm, Directus migrate dở, ba instance khởi động cùng lúc. File cấu hình
lỗi nằm ở `tests/parity/src/startup/config-files.test.ts`, tắt máy khi đang có request ở `startup/shutdown.test.ts`.
`redis-down.test.ts` dừng Redis và kiểm API vẫn khởi động (FR-025); ca rate limiter và health khi Redis dừng nằm ở
`server/errors.test.ts`, `server/health.test.ts`.

## 8. Benchmark so với Directus

```bash
pnpm nx run benchmark:env-up
```

```bash
pnpm nx run benchmark:run
```

```bash
pnpm nx run benchmark:env-down
```

Chỉ chạy trên Postgres; `run` không tự dựng môi trường.

Mong đợi: bảng p95 và request/giây cho `/server/ping`, `/server/health`, `/server/info` (so với Directus
mặc định) và `/server/specs/oas` (so với Directus `CACHE_SCHEMA=false`); lệnh trả mã lỗi khi API mới tệ hơn
quá 10%.

## 9. Log và metrics

Nằm trong `PARITY_SUITE=full` với profile `metrics` (`LOG_STYLE=raw`, `METRICS_ENABLED=true`, `METRICS_TOKENS`):
`tests/parity/src/observability/metrics.test.ts` so tên metric và help text, `logs.test.ts` so tập key của dòng log
HTTP và kiểm giá trị nhạy cảm bị che. Mong đợi: mọi test đạt (US5, SC-005).

## 10. App web khung

```bash
pnpm nx serve web
```

Mở URL dev server in ra, thêm `/admin/`: thấy chữ "Backoffice" và kết quả ping. Sửa `public/config.json` (URL API)
rồi tải lại: app gọi URL mới.

```bash
pnpm nx run web-e2e:e2e
```

Mong đợi: smoke test Playwright đạt (US7). Lần đầu cài trình duyệt: `pnpm --filter @backoffice/web-e2e exec playwright
install chromium`.

Image web (nginx không root, cổng 8080) lấy URL API từ biến `PUBLIC_URL` của Directus lúc container khởi động
(Nguyên tắc VIII), mặc định `/`:

```bash
docker build -f apps/web/Dockerfile -t backoffice-web .
```

```bash
docker run --rm -p 8080:8080 -e PUBLIC_URL=http://localhost:8056 backoffice-web
```

Mở `http://localhost:8080/admin/`; chạy e2e với image này: `BASE_URL=http://127.0.0.1:8080 pnpm nx run web-e2e:e2e`.

## 11. Dọn dẹp

```bash
docker compose -f dev/directus-reference/docker-compose.yml --profile backoffice down
```
