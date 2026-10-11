# Quickstart: kiểm tra items, cache, export, event (005)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p api
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app,blackbox
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

```bash
pnpm nx run parity-tests:parity-blackbox --vendor=postgres
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=cache-mem,cache-mem-purge,cache-redis,cache-redis-purge,websocket
```

```bash
pnpm nx run parity-tests:parity-cache --vendor=postgres
```

```bash
BASE_URL=http://127.0.0.1:8160 pnpm nx run directus-app-e2e:e2e
```

- Dòng 1: unit test (coverage 80%), gồm test port từ Directus (`get-cache-key`, `get-cache-headers`,
  `should-skip-cache`, `permissions-cacheable`, `import-export`) và test mới của `respond`, middleware `cache`,
  `collection-exists`, `items.controller`, `emitter`, `websocket/controllers/hooks`.
- Dòng 2, 3: môi trường đối chiếu chính (cache bật, `CACHE_SKIP_ALLOWED=true`) và bộ `full`, nay có
  `src/items/crud.test.ts`, `export.test.ts` và chạy lại toàn bộ 001 đến 004 với `respond` mới (FR-047).
- Dòng 4: bộ blackbox items, query, relational port từ Directus, hai lượt (`backoffice` rồi `directus`) trên cặp
  `blackbox` (cần `--profiles=blackbox` ở `env-up`), chạy sau dòng 3: seed của nó thêm admin vào cùng database, nên
  `db-unchanged.test.ts` của dòng 3 chạy sau đó sẽ dừng với lỗi và cần `env-down`, `env-up` lại; thêm
  `PARITY_BLACKBOX_PK_TYPES=integer` để chạy bộ rút gọn (MySQL, SQLite ở CI). Với `--vendor=mysql` hoặc `sqlite3`:
  `env-up` không cần profile.
- Dòng 5, 6: năm cặp profile của cache và WebSocket, rồi bộ `cache` (port `cache.test.ts`, `cache-purge.test.ts`, ca
  dùng chéo, `bus.test.ts`, ca Redis dừng của `redis-down`).
- Dòng 7: Playwright qua proxy (profile `app` ở dòng 2), nay có `items.spec.ts` (module Content, tải CSV).

Benchmark (hằng tuần, chỉ Postgres, nạp 10 triệu dòng vài phút):

```bash
pnpm nx run benchmark:env-up
```

```bash
pnpm nx run benchmark:items
```

## 2. Kiểm bằng tay

Với môi trường ở §1 (Directus `127.0.0.1:8155`, app mới `127.0.0.1:8156`, token admin của env):

```bash
curl -s -X POST http://127.0.0.1:8155/collections -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"collection":"demo","schema":{},"meta":{},"fields":[{"field":"id","type":"integer","schema":{"is_primary_key":true,"has_auto_increment":true}},{"field":"title","type":"string"}]}'
```

```bash
curl -s -X POST http://127.0.0.1:8156/items/demo -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"title":"hello"}'
```

```bash
curl -si "http://127.0.0.1:8156/items/demo?limit=1" -H "Authorization: Bearer $TOKEN" | grep -i "x-cache-status\|cache-control"
```

```bash
curl -si "http://127.0.0.1:8155/items/demo?limit=1" -H "Authorization: Bearer $TOKEN" | grep -i "x-cache-status\|cache-control"
```

```bash
curl -sD - -o demo.csv "http://127.0.0.1:8156/items/demo?export=csv" -H "Authorization: Bearer $TOKEN" | grep -i "content-"
```

- Lệnh 1 tạo collection ở Directus (006 chưa có `/collections` ở app mới); lệnh 2 tạo item ở app mới.
- Lệnh 3 rồi 4: lần đầu `x-cache-status: MISS`, lần sau ở app kia `HIT` (cặp chính có `CACHE_AUTO_PURGE=true` nên
  `Cache-Control: no-cache`; với cặp `cache-redis` ở cổng 9255, 9256 thấy `public, max-age=..., s-maxage=0`).
- Lệnh 5: `Content-Disposition: attachment; filename="demo <YYYYMMDD-HMS>.csv"`, `Content-Type: text/csv; charset=utf-8`;
  `demo.csv` giống file tải từ Directus.

Xem thông điệp bus (cặp `websocket`, cổng 9456):

```bash
docker exec -it parity-postgres-redis-1 redis-cli PSUBSCRIBE '*websocket.event*'
```

Rồi ghi một item ở `http://127.0.0.1:9456/items/demo`: thấy `{"collection":"demo","action":"create","key":...}`. Ở
cặp chính (`WEBSOCKETS_ENABLED=false`) không có thông điệp.

## 3. Đóng feature

1. CI xanh: `quality`, `guard-*`, `parity` (3 vendor), `parity-blackbox`, `parity-cache`, `parity-matrix-rotating`,
   `e2e-directus-app`, `docker`, `security`.
2. `parity-matrix.yml` xanh (ma trận quyền 004 và `blackbox-full` MySQL, SQLite); `benchmark.yml` `benchmark-items` đã
   chạy một lần, kết quả ghi vào tasks.
3. Tech lead duyệt bảng khác biệt (D-09.3, D-11, D-12, D-30 gỡ; D-26, D-29 thu hẹp) và R-07, R-08; sửa bảng của spec
   001, 003, 004; xóa entry khỏi `accepted-differences.ts`; `Status: Done`.
