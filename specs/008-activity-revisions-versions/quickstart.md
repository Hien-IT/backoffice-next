# Quickstart: kiểm tra activity, revisions, versions, comments (008)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p api @backoffice/types
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app,assets-limit,assets-stress,retention
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=blackbox,schema-cache,schema-cache-nomsg,tz-asia,tz-america,assets-limit,assets-stress
```

```bash
pnpm nx run parity-tests:parity-blackbox --vendor=postgres
```

```bash
pnpm nx run directus-app-e2e:e2e
```

## 2. Kiểm tay: lịch sử app mới ghi hiển thị trong Directus

1. Mở app Directus qua proxy (`http://localhost:<cổng proxy>/admin`), tạo collection `posts` với Accountability
   "Track activity & revisions" và bật Content Versioning.
2. Gọi app mới: `PATCH /items/posts/1` với `{"title": "v2"}` (token admin, header `User-Agent: quickstart`).
3. Mở item trong app Directus: sidebar Revisions có dòng mới với người dùng, thời gian, IP, user agent `quickstart`; mở
   so sánh thấy `title` cũ và mới; bấm Revert rồi Save; sidebar có thêm dòng.
4. Module Activity: dòng `update` tương ứng, chi tiết có IP và user agent.

## 3. Kiểm tay: version tạo bên này promote bên kia

```bash
curl -s -X POST http://localhost:<app mới>/versions -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"key":"draft","name":"Draft","collection":"posts","item":"1"}'
```

```bash
curl -s -X POST http://localhost:<app mới>/versions/<id>/save -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"title":"from draft"}'
```

```bash
curl -s http://localhost:<directus>/versions/<id>/compare -H "Authorization: Bearer <token>"
```

```bash
curl -s -X POST http://localhost:<directus>/versions/<id>/promote -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"mainHash":"<mainHash của compare>"}'
```

Kỳ vọng: `compare` trả `outdated: false`, `current.title = "from draft"`; `promote` trả `1`; `GET /items/posts/1` ở
cả hai app trả `title = "from draft"`; `/revisions` có dòng `version_save` (gắn version) và dòng `update`. Làm ngược
chiều (tạo ở Directus, promote ở app mới) cho cùng kết quả.

## 4. Kiểm tay: comment và mention

```bash
curl -s -X POST http://localhost:<app mới>/comments -H "Authorization: Bearer <token>" -H 'Content-Type: application/json' -d '{"collection":"posts","item":"1","comment":"xin chào @<uuid user khác>"}'
```

Kỳ vọng: sidebar Comments của app Directus hiển thị comment với tên người được nhắc; user đó có thông báo ở chuông;
log app mới có một dòng cảnh báo không gửi email nếu user bật email notifications (D-33).

## 5. Kiểm tay: retention

Đặt trong `.env` dùng chung `RETENTION_ENABLED=true`, `RETENTION_SCHEDULE=* * * * *`, `ACTIVITY_RETENTION=1m`,
`REVISIONS_RETENTION=1m`; khởi động lại hai app; sau hai phút `GET /activity?filter[timestamp][_lt]=<now-1m>` trả
rỗng ở cả hai app; `redis-cli monitor` thấy một tiến trình đặt khóa `schedule--data-retention` mỗi kỳ.
