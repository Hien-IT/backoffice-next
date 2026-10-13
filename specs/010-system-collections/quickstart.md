# Quickstart: kiểm tra collection hệ thống còn lại (010)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p api @backoffice/utils
```

Môi trường đối chiếu Postgres (cặp `setup` có DB riêng, chỉ Postgres; registry giả luôn chạy):

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app,assets-limit,assets-stress,setup
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

Blackbox hai lượt (gồm `mail.test.ts` và các file dùng `/presets`, `/utils/cache/clear`):

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america,assets-limit,assets-stress,cache-mem
```

```bash
pnpm nx run parity-tests:parity-blackbox --vendor=postgres
```

E2E app Directus qua proxy (cần profile `app` và `setup`):

```bash
BASE_URL=http://127.0.0.1:8160 pnpm nx run directus-app-e2e:e2e
```

Benchmark (môi trường riêng, tắt môi trường parity trước):

```bash
pnpm nx run benchmark:env-up && BENCH_ROUNDS=3 pnpm nx run benchmark:system --output-style=static
```

## 2. Kiểm tay: cùng request, cùng kết quả ở hai app

Directus `http://localhost:8155`, app mới `http://localhost:8156`; token admin lấy qua `POST /auth/login`.

Settings đổi ở app mới, Directus thấy ngay:

```bash
curl -s -X PATCH http://localhost:8156/settings -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"project_name":"Parity"}' && curl -s http://localhost:8155/server/info | jq .data.project.project_name
```

Băm ở app này, kiểm ở app kia:

```bash
HASH=$(curl -s -X POST http://localhost:8156/utils/hash/generate -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"string":"secret"}' | jq -r .data) && curl -s -X POST http://localhost:8155/utils/hash/verify -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"string\":\"secret\",\"hash\":\"$HASH\"}"
```

Share tạo ở Directus, đăng nhập ở app mới:

```bash
SHARE=$(curl -s -X POST http://localhost:8155/shares -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"collection":"posts","item":"1","password":"pw"}' | jq -r .data.id) && curl -s -X POST http://localhost:8156/shares/auth -H 'Content-Type: application/json' -d "{\"share\":\"$SHARE\",\"password\":\"pw\"}"
```

Không gửi email: thông báo ghi dòng DB và một dòng log cảnh báo:

```bash
curl -s -X POST http://localhost:8156/notifications -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"recipient":"<user id>","subject":"hello"}' && docker compose -p parity-postgres logs --no-log-prefix backoffice-api | grep 'mail sending is out of scope' | tail -1
```

Bundle extension rỗng:

```bash
curl -si http://localhost:8156/extensions/sources/index.js | head -20
```

## 3. Đóng feature

Như 007 đến 009: commit đóng ghi `Status: Done`, dòng `Duyệt khác biệt`, xóa D-09.8 và D-14, sửa D-31 (bỏ
`removeAt`), thêm D-36, D-37, D-38 trong `tests/parity/accepted-differences.ts`, sửa bảng của spec 001 và 004, điền
bằng chứng R-25 đến R-28.
