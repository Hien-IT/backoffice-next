# Contract: image FE và BE

## BE `hiennd23/backoffice-api`

| Mục | Giá trị | Nguồn |
|-----|---------|-------|
| Cổng | 8055 (`PORT`, `HOST`, `UNIX_SOCKET_PATH` như Directus) | 001 FR-081 |
| `WORKDIR` | `/directus`; thư mục `database`, `extensions`, `uploads` có sẵn, chủ `node` | `apps/api/Dockerfile`, `directus/Dockerfile` |
| User | `node`, uid/gid 1000 (giống image Directus); không bao giờ root lúc chạy | R3, FR-025 |
| Entrypoint | `["/sbin/tini", "--"]` (PID 1: dọn zombie, chuyển tín hiệu) | FR-026 |
| Lệnh | `["node", "dist/main.js"]`, một process Node; không `bootstrap`, không PM2 | 001 D-19, D-121 |
| Env mặc định trong image | `DB_CLIENT=sqlite3`, `DB_FILENAME=/directus/database/database.sqlite`, `NODE_ENV=production` (như Directus) | `apps/api/Dockerfile` |
| Nhãn OCI | `org.opencontainers.image.title=backoffice-api`, `.version=<BACKOFFICE_VERSION>`, `.revision=<VCS_REF>`, `.source=<repo>`, `io.backoffice.directus-compat=11.17.4` | FR-022 |
| Tín hiệu | SIGTERM/SIGINT/SIGHUP → trình tự 001 FR-080, mã thoát 143 với SIGTERM | 001 |
| Probe | startup + liveness `GET /server/ping` (`200 pong`), readiness `GET /server/health` (`503` khi `error`, gồm lúc đang tắt) | FR-031, FR-032 |

Đổi image một service Directus: giữ mọi env, volume, cổng, probe. Ngoại lệ: `command`/`args` gọi CLI Directus phải bỏ
(FR-024).

## FE `hiennd23/backoffice-web`

| Request | Response |
|---------|----------|
| `GET /` | `302 /admin/` (chỉ khi gọi thẳng container FE; qua Ingress `/` vào BE) |
| `GET /admin` | `200` `index.html`, `Cache-Control: no-cache`, `Vary: Origin, Cache-Control`, CSP |
| `GET /admin/` | như trên |
| `GET /admin/assets/<hash>.js` (có) | `200`, `Cache-Control: max-age=31536000, immutable`, `Vary: Origin, Cache-Control`, CSP |
| `GET /admin/<path bất kỳ không có file>` | `200` `index.html` (kể cả có đuôi file), như Directus |
| `GET /admin/config.json` | `200` `{ "apiUrl": "<PUBLIC_URL hoặc />" }`, `Cache-Control: no-store` |
| `*.mjs` | `Content-Type: application/javascript` (012) |

Cổng 8080, user nginx (101), không bao giờ root (FR-025). nginx master thu dọn worker nên không cần init thêm.
Probe: `GET /admin/config.json`.

### CSP

Header `Content-Security-Policy` trên mọi response của FE, sinh một lần khi container khởi động:

1. Nếu `CONTENT_SECURITY_POLICY_USE_DEFAULTS` khác `false`: bắt đầu từ directive mặc định của helmet.
2. Gộp directive của Directus 11.17.4 (`directus/api/src/app.ts:166-195`): `script-src 'self' 'unsafe-eval'`, bỏ
   `upgrade-insecure-requests`, `worker-src 'self' blob:`, `child-src 'self' blob:`, `img-src 'self' data: blob:
   https://raw.githubusercontent.com https://avatars.githubusercontent.com`, `media-src 'self'`, `connect-src 'self'
   https://* wss://*`.
3. Với mỗi biến `CONTENT_SECURITY_POLICY_DIRECTIVES__<NAME>`: tên → `kebab-case` thường; giá trị bỏ tiền tố `array:`, tách
   theo dấu phẩy, nối bằng khoảng trắng, thay directive cùng tên; giá trị `false` hoặc rỗng → bỏ directive.
4. Thứ tự và cách viết khớp đúng header Directus trả cho `/admin` với cùng env (test `web-image.test.ts` so chuỗi).

Ngoài phạm vi: các biến `CONTENT_SECURITY_POLICY_*` khác (`REPORT_ONLY`...): nếu có trong env thì `40-config.sh` ghi
cảnh báo ra stderr và bỏ qua.
