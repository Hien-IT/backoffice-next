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

## 1. Build, lint, test toàn workspace

```bash
pnpm nx run-many -t lint typecheck test build
```

Mong đợi: tất cả đạt; coverage `apps/api` và libs BE ≥ 80%, `apps/web` ≥ 60% (in ở cuối mỗi project).

## 2. Bật Directus tham chiếu

```bash
docker compose -f dev/directus-reference/docker-compose.yml up -d --wait
```

Directus 11.17.4 chạy ở `http://localhost:8055`, cùng Postgres (PostGIS), Redis, MinIO.

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
`/server/ping`, `/server/health`, `/server/specs/oas` (ở OAS, `info.version` khác nhau vì là hash thời
điểm request).

## 5. Chạy bộ test đối chiếu

Bộ test tự dựng môi trường riêng (DB, Redis, MinIO, Directus, API mới) bằng
`tests/parity/docker-compose.yml`, cả hai app đọc cùng file `tests/parity/env/<vendor>.env`.

```bash
pnpm nx run parity-tests:env-up --vendor=postgres
```

```bash
TEST_DB=postgres PARITY_SUITE=full pnpm nx run parity-tests:test
```

```bash
pnpm nx run parity-tests:env-down --vendor=postgres
```

`TEST_DB` nhận `postgres`, `mysql`, `maria`, `sqlite3`, `mssql`, `oracle`, `cockroachdb`.
`PARITY_SUITE=reduced` chạy bộ rút gọn (ping, health, info, 404).

Mong đợi: mọi test đạt. Khi có khác biệt chưa được chấp nhận, test in endpoint, vị trí (header hoặc
JSON pointer) và giá trị hai bên.

## 6. Kiểm tra DB không bị thay đổi

Nằm trong `PARITY_SUITE=full` (file `tests/parity/src/db-unchanged.test.ts`): dừng Directus, chụp
schema và checksum dữ liệu mọi bảng (cả `directus_*` lẫn bảng người dùng), chạy API mới, gửi toàn bộ request của bộ test, gửi
`SIGTERM`, chụp lại và so sánh. Mong đợi: hai bản chụp giống hệt. `readonly-account.test.ts` chạy lại cùng kịch bản với một role Postgres
chỉ có SELECT (FR-024).

## 7. Kiểm tra dừng khi migration lệch

Nằm trong `PARITY_SUITE=full` (file `tests/parity/src/startup.test.ts`): tạo DB tạm từ DB đã migrate,
xóa hoặc thêm dòng trong `directus_migrations` của DB tạm, chạy API mới và kiểm tra mã thoát 1 cùng dòng
log liệt kê version thiếu/thừa (contract: [startup.md](./contracts/startup.md)).

Các kịch bản khởi động khác trong cùng file: migration tùy biến hợp lệ (ở `MIGRATIONS_PATH` và
`EXTENSIONS_PATH/migrations`), cổng bị chiếm, file cấu hình lỗi, Directus migrate dở, ba instance khởi
động cùng lúc. `redis-down.test.ts` dừng Redis và kiểm FR-025.

## 8. Benchmark so với Directus

```bash
pnpm nx run benchmark:run --vendor=postgres
```

Mong đợi: bảng p95 và request/giây cho `/server/ping`, `/server/health`, `/server/info` (so với Directus
mặc định) và `/server/specs/oas` (so với Directus `CACHE_SCHEMA=false`); lệnh trả mã lỗi khi API mới tệ hơn
quá 10%.

## 9. Dọn dẹp

```bash
docker compose -f dev/directus-reference/docker-compose.yml --profile backoffice down
```
