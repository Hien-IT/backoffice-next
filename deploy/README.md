# Triển khai Backoffice

Tài liệu vận hành của feature 019 (`specs/019-deployment-packaging/`). Backoffice gồm hai image:

| Image                     | Nội dung                                              | Cổng | User                                |
| ------------------------- | ----------------------------------------------------- | ---- | ----------------------------------- |
| `hiennd23/backoffice-api` | API (BE), thay được image `directus/directus:11.17.4` | 8055 | `node` (1000:1000), PID 1 là `tini` |
| `hiennd23/backoffice-web` | App quản trị ở `/admin` (FE, nginx)                   | 8080 | `backoffice` (1001:1001)            |

Build tại máy (linux/amd64, qua `@nx-tools/nx-container`):

```bash
pnpm nx run api:container
pnpm nx run web:container
```

## Thay image Directus bằng Backoffice

Trong một service Directus đang chạy (compose hoặc Deployment Kubernetes), chỉ đổi `image:` thành
`hiennd23/backoffice-api:<tag>`. Env, volume (`/directus/uploads`, `/directus/database`, `/directus/extensions`), cổng
8055 và probe giữ nguyên: image Backoffice dùng cùng thư mục làm việc `/directus`, cùng uid/gid 1000, cùng cách đọc env,
`.env`, `CONFIG_PATH`, hậu tố `_FILE`.

Giới hạn (FR-024):

- DB phải đã được Directus khởi tạo. Backoffice không chạy `bootstrap` và không ghi bảng hệ thống khi khởi động: gặp DB
  trống hoặc thiếu migration thì dừng và báo migration nào lệch. DB mới: chạy image Directus một lần trước (hoặc giữ ít
  nhất một instance Directus). Nâng phiên bản Directus thì Directus chạy migration.
- Bỏ mọi ghi đè `command`/`args` gọi CLI Directus (ví dụ `npx directus bootstrap && pm2-runtime ...`). Trên Kubernetes,
  ghi đè `command` còn bỏ qua `tini` (ENTRYPOINT của image).
- Extension của Directus không chạy trên Backoffice.
- `SERVE_APP=true` chỉ gây một dòng cảnh báo: app quản trị chạy ở image web. Các biến `PM2_*` không có tác dụng (không
  phải biến của Directus, chỉ PM2 trong image Directus đọc): muốn thêm tiến trình thì tăng số replica.

## CSP của app quản trị

Container web gửi đúng header `Content-Security-Policy` mà Directus 11.17.4 gửi cho `/admin`, sinh lúc khởi động từ các
biến `CONTENT_SECURITY_POLICY_DIRECTIVES__*` và `CONTENT_SECURITY_POLICY_USE_DEFAULTS` của env chung
(`apps/web/docker/csp.awk`). Quy tắc giống Directus:

- Giá trị danh sách (`array:a,b` hoặc `a,b`) gộp **theo vị trí** với danh sách của Directus: muốn thêm một nguồn vào
  `img-src` phải liệt kê lại cả năm nguồn của Directus rồi mới tới nguồn mới.
- Giá trị `false` làm Directus không khởi động; container web bỏ biến đó và ghi cảnh báo.
- Các biến `CONTENT_SECURITY_POLICY_*` khác (`REPORT_ONLY`...) bị bỏ qua, có cảnh báo.

App ở origin khác API (không phải hai chế độ của 019): thêm origin của API vào `connect-src`, `img-src`, `media-src`, ví
dụ `CONTENT_SECURITY_POLICY_DIRECTIVES__CONNECT_SRC=array:'self',https://*,wss://*,https://api.example.com`.

Live preview (khung xem trang ở trang item) mở một site khác trong iframe: thêm site đó vào `frame-src`, ví dụ
`CONTENT_SECURITY_POLICY_DIRECTIVES__FRAME_SRC=https://preview.example.com`. Directus cũng cần đúng biến này.
