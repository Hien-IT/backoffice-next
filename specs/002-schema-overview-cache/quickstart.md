# Quickstart: kiểm tra schema overview và cache dùng chung

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p @backoffice/memory @backoffice/utils api
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=multi,cache-config
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

- Dòng thứ nhất chạy unit test của `@backoffice/memory`, `@backoffice/utils` và `apps/api`, kèm ngưỡng coverage
  80%.
- Dòng thứ hai bật môi trường đối chiếu với hai instance app mới (profile `multi`) và cặp có namespace riêng
  (profile `cache-config`).
- Dòng thứ ba chạy bộ `full`, gồm các file trong `src/schema/`.
- MySQL và SQLite chạy bộ `reduced`, trong đó có `src/schema/overview.test.ts`.

## 2. Thử bằng tay với Directus tham chiếu

Dùng `dev/directus-reference` (Directus ở 8055, Redis ở 6379) và service `backoffice-api` của compose đó
(quickstart 001 §2–§4).

1. Mở một terminal theo dõi bus:

   ```bash
   docker compose -f dev/directus-reference/docker-compose.yml exec redis redis-cli PSUBSCRIBE 'directus:bus:*'
   ```

2. Gọi `GET /server/specs/oas` ở app mới để làm ấm cache.
3. Trong app quản trị Directus (http://localhost:8055/admin):
   - Tạo collection `articles`.
   - Cho role Public quyền đọc `articles`.
   - Thêm field `rating`.

   Terminal ở bước 1 hiện message trên kênh `directus:bus:schemaChanged`.
4. Gọi lại `GET /server/specs/oas` ở app mới: tài liệu có `rating`. Không khởi động lại app mới.
5. Chiều ngược lại:
   - Thêm cột trực tiếp trên DB và dòng tương ứng trong `directus_fields`.
   - Chạy `clearSystemCache()` trong container app mới theo lệnh helper ở `tests/parity/src/schema/clear-system-cache.ts`.
   - Gọi `GET /server/specs/oas` ở Directus: tài liệu có cột mới.

## 3. Xem key và kênh trên Redis

```bash
docker compose -f dev/directus-reference/docker-compose.yml exec redis redis-cli --scan --pattern 'permissions:*'
```

```bash
docker compose -f dev/directus-reference/docker-compose.yml exec redis redis-cli PUBSUB CHANNELS '*'
```

Kết quả mong đợi:

- Key `permissions:policies-…` và `permissions:raw-permissions-…`.
- Kênh `directus:bus:schemaChanged` và `permissions:multi-cache`.
- Kênh `directus:bus:schemaCache--done` chỉ xuất hiện trong lúc có process đang chờ.

So với [contracts/redis.md](./contracts/redis.md).
