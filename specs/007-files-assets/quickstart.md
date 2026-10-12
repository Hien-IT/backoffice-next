# Quickstart: kiểm tra files, folders, assets, TUS (007)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p api utils types
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app,assets-limit,assets-stress
```

```bash
PARITY_STORAGES=local,s3 pnpm nx run parity-tests:parity --vendor=postgres
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america,assets-limit
```

```bash
PARITY_STORAGES=local,s3 pnpm nx run parity-tests:parity-blackbox --vendor=postgres
```

```bash
BASE_URL=http://127.0.0.1:8160 pnpm nx run directus-app-e2e:e2e
```

- Dòng 1: unit test (coverage 80%), gồm test port từ Directus (`files.service`, `folders.service`, `assets.service`,
  `tus/server`, `get-sharp-instance`, `get-metadata`, `transformations`, `request/*`) và test mới (bốn controller,
  `multipartHandler`, `checkFileAccess`, `synchronization`, `scheduleSynchronizedJob`, `router-options`).
- Dòng 2, 3: môi trường đối chiếu chính (thêm `files-fixtures`, volume `uploads`, cặp `assets-limit`, `assets-stress`) và bộ `full`,
  nay có `src/files/{files,folders,import,assets,transform-matrix,cross-use,tus,zip,e2e-files,e2e-assets}.test.ts`.
  `PARITY_STORAGES=s3` để chỉ chạy S3 (MySQL, SQLite mỗi lần push).
- Dòng 4, 5: bộ blackbox (005, 006 + 8 file của 007), hai lượt `backoffice` rồi `directus`.
- Dòng 6: Playwright app Directus qua proxy, thêm `files.spec.ts` và ca thumbnail; `/files`, `/folders`, `/assets` đi
  tới app mới.

## 2. Kiểm tay dùng chéo

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -F storage=s3 -F title=Demo -F file=@tests/parity/fixtures/files/photo.jpg http://127.0.0.1:8156/files
```

```bash
curl -s -o /tmp/a.webp -H "Authorization: Bearer $ADMIN_TOKEN" "http://127.0.0.1:8155/assets/<id>?width=300&height=300&fit=cover&format=webp"
```

```bash
curl -s -o /tmp/b.webp -H "Authorization: Bearer $ADMIN_TOKEN" "http://127.0.0.1:8156/assets/<id>?width=300&height=300&fit=cover&format=webp" && cmp /tmp/a.webp /tmp/b.webp && echo SAME
```

- Dòng 1: tải lên ở app mới (8156) vào MinIO. Dòng 2: Directus (8155) sinh file phát sinh. Dòng 3: app mới trả cùng
  file; `cmp` không báo khác; trong MinIO (`mc ls local/directus`) chỉ có một object `<id>__<hash>.webp`.

## 3. Benchmark

```bash
pnpm nx run benchmark:files
```

Trong `tests/benchmark/`: seed 200 ảnh và 1.000 dòng file, chạy năm kịch bản (contracts/parity.md §6), in bảng so với
ngưỡng 10%; `asset-transform` xóa file phát sinh trước mỗi vòng.

## 4. Kiểm startup với driver ngoài phạm vi

```bash
STORAGE_LOCATIONS=local,cloud STORAGE_CLOUD_DRIVER=gcs pnpm nx run api:serve
```

App thoát mã 1 và log `Storage location "cloud" uses driver "gcs", which is not supported by Backoffice. Supported
drivers: local, s3.` (D-16; `tests/parity/src/startup/storage.test.ts`).
