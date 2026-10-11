# Quickstart: kiểm tra phân quyền (004)

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p @backoffice/utils @backoffice/types api
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso,user-limits,app
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

```bash
PARITY_MATRIX_SHARD=1/4 pnpm nx run parity-tests:parity-matrix --vendor=postgres
```

```bash
BASE_URL=http://127.0.0.1:8160 pnpm nx run directus-app-e2e:e2e
```

- Dòng thứ nhất chạy unit test (coverage 80%), gồm test port từ Directus của engine (`get-ast-from-query`, `run-ast`,
  helper dialect), module quyền (`process-ast`, `process-payload`, `validate-access`, `get-permissions-for-share`...),
  `ItemsService`, `PayloadService`, `MetaService`, `UsersService`, `RolesService`, `sanitize-query`, `validate-query`,
  `validate-batch`, và test của năm controller.
- Dòng thứ hai bật môi trường đối chiếu với mọi profile của bộ `full`, gồm hai profile mới: `user-limits` (cặp
  8855, 8856 với `USERS_*_ACCESS_LIMIT` thấp) và `app`: reverse proxy ở `127.0.0.1:8160` (route của 001 đến 004 vào app
  mới 8156, còn lại vào Directus 8155; danh sách ở `tests/parity/proxy/backoffice-routes.txt`).
- Dòng thứ ba chạy bộ `full`, gồm `src/permissions/**` (CRUD năm endpoint, mời, đăng ký, TFA, cache dùng chéo, quy
  tắc đọc ghi, query) và chạy lại `src/auth/**` của 003. MySQL và SQLite chạy bộ `reduced` (`matrix-reduced`,
  `accountability`, `users`, `roles`, `write-rules`).
- Dòng thứ tư chạy một shard của ma trận quyền (FR-101); bỏ `PARITY_MATRIX_SHARD` để chạy đủ 650 nhóm (khoảng 30
  phút trên máy có Directus giả lập amd64). CI chạy một shard xoay vòng mỗi lần push và đủ bốn shard ở
  `parity-matrix.yml`.
- Dòng thứ năm chạy Playwright: app Directus qua proxy (cần `pnpm exec playwright install chromium` một lần trong
  `tests/directus-app-e2e`). Mỗi kịch bản chạy với proxy rồi với Directus thuần và so dòng DB.

Benchmark (hằng tuần, chỉ Postgres):

```bash
pnpm nx run benchmark:env-up
```

```bash
pnpm nx run benchmark:permissions
```

## 2. Thử bằng tay với Directus tham chiếu

Dùng cặp chính của môi trường đối chiếu: Directus `D=http://127.0.0.1:8155`, app mới `B=http://127.0.0.1:8156`,
cùng DB và Redis. URL có `[...]` (như `filter[email][_eq]`) cần `curl -g`. Lấy access token admin:

```bash
curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"password"}'
```

1. Tạo role, policy, access ở app mới rồi đọc ở Directus:

   ```bash
   curl -s -X POST "$B/roles" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Editors"}'
   ```

   ```bash
   curl -s -X POST "$B/policies" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"name":"Editors policy","app_access":true,"permissions":{"create":[{"collection":"directus_users","action":"read","permissions":{"id":{"_eq":"$CURRENT_USER"}},"fields":["id","email","first_name"]}]}}'
   ```

   ```bash
   curl -s -X POST "$B/access" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"role":"<role id>","policy":"<policy id>"}'
   ```

   `GET "$D/policies/<policy id>?fields=*,permissions.*"` phải trả policy và permission vừa tạo.
2. Tạo user `editor@example.com` với role đó, lấy token của user rồi gọi hai app:

   ```bash
   curl -s "$B/users?fields=id,email,password" -H "Authorization: Bearer $EDITOR_TOKEN"
   ```

   Cả hai app trả `403 FORBIDDEN` cùng message (`field "password"`). Bỏ `password`: cả hai trả một dòng, hai field.
3. Sửa permission ở Directus (thêm field `last_name`), gọi lại `GET "$B/users?fields=id,last_name"`: app mới dùng
   quyền mới ngay (cache quyền dùng chung đã bị xóa).
4. `GET "$B/permissions/me"`, `GET "$B/policies/me/globals"`, `GET "$B/roles/me"` với token của editor: giống
   Directus (`read.access: "partial"`, `app_access: true`, `admin_access: false`).
5. Mời user ở app mới: `POST "$B/users/invite"` với `{"email":"new@example.com","role":"<role id>"}` trả `204`; log
   của app mới có dòng `[email] Invitation email to "new@example.com" was not sent: Backoffice does not send email.`,
   không có token; `GET "$D/users?filter[email][_eq]=new@example.com"`
   trả user `invited`.
6. Thử lỗi: đặt `parent` của role thành chính nó (`400 A role cannot be a parent of itself`), xóa policy admin cuối
   (`422 Cannot remove the last admin user from the system`), `ip_access: ["*"]` (`400 IP Access contains an incorrect
   value...`). Cả hai app trả giống nhau.
7. Token tới route cũ: `GET "$B/server/health"` với token admin trả chi tiết; token sai chữ ký trả `403 INVALID_TOKEN`
   (không còn cảnh báo "token bị bỏ qua" trong log).

## 3. Thử app Directus qua proxy (profile `app`)

Mở `http://127.0.0.1:8160/admin/` trong trình duyệt, đăng nhập `admin@example.com` / `password` (admin chưa đặt
project owner nên app hiện hộp nhắc giấy phép BSL; "Remind Later" đóng nó tới lần đăng nhập sau). Module User và
Settings > Access Policies, Roles hoạt động; trong log của `parity-postgres-proxy-1` (`docker logs`), request
`/users`, `/roles`, `/policies`, `/access`, `/permissions`, `/auth`, `/server` có upstream là `backoffice-api`, các
request khác là `directus`.

## 4. Gỡ môi trường

```bash
pnpm nx run parity-tests:env-down --vendor=postgres
```
