# Quickstart: kiểm tra xác thực và phiên đăng nhập

Cần môi trường của feature 001: Node 22, pnpm 10, Docker. Lệnh chạy từ thư mục gốc repo.

## 1. Test tự động

```bash
pnpm nx run-many -t test -p @backoffice/validation @backoffice/utils @backoffice/types api
```

```bash
pnpm nx run parity-tests:env-up --vendor=postgres --profiles=ratelimit,cors-hsts,pressure,metrics,multi,cache-config,sso
```

```bash
pnpm nx run parity-tests:parity --vendor=postgres
```

- Dòng thứ nhất chạy unit test, kèm ngưỡng coverage 80%. Unit test gồm test port từ Directus của driver `local`,
  `openid`, `oauth2`, `ldap`, `authenticate`, `jwt`, `stall`, `resolve-login-redirect`, `generate-callback-url`.
- Dòng thứ hai bật môi trường đối chiếu với mọi profile của bộ `full`, gồm profile `sso` mới: IdP giả lập (6110),
  OpenLDAP (6109), Directus ở 8955 và app mới ở 8956.
- Dòng thứ ba chạy bộ `full`, gồm `src/auth/**`. MySQL và SQLite chạy bộ `reduced` (`login`, `refresh`, `logout`,
  `password`).

Benchmark auth (2.000 kết nối, chỉ Postgres):

```bash
pnpm nx run benchmark:env-up-auth
```

```bash
pnpm nx run benchmark:auth
```

`env-up-auth` tắt pressure limiter của cả hai app (`tests/benchmark/auth.compose.yml`). Trên máy arm64, Directus chạy
giả lập nên số liệu chỉ có ý nghĩa trên CI; đo thử nhỏ hơn bằng `BENCH_CONNECTIONS=200 BENCH_ROUNDS=1`.

## 2. Thử bằng tay với Directus tham chiếu

Dùng `dev/directus-reference`: Directus ở 8055 và service `backoffice-api` của compose đó (quickstart 001 §2–§4), cùng
`SECRET`, DB và Redis. Đặt `D=http://localhost:8055` và `B=<URL app mới>`.

1. Đăng nhập ở app mới, chế độ `json`:

   ```bash
   curl -s -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"email":"admin@example.com","password":"password"}'
   ```

   Kết quả: `{"data":{"expires":900000,"refresh_token":"...","access_token":"..."}}`.
2. Dùng access token vừa nhận ở Directus:

   ```bash
   curl -s "$D/users/me" -H "Authorization: Bearer <access_token>"
   ```

   Kết quả: thông tin của `admin@example.com`.
3. Refresh ở Directus bằng refresh token do app mới cấp:

   ```bash
   curl -s -X POST "$D/auth/refresh" -H 'Content-Type: application/json' -d '{"refresh_token":"<refresh_token>"}'
   ```

   Rồi logout ở app mới bằng refresh token mới. Refresh lại ở Directus phải trả `401 INVALID_CREDENTIALS`.
4. Chế độ `cookie` và `session`: thêm `"mode":"cookie"` hoặc `"mode":"session"`, gọi `curl -i` và so header
   `Set-Cookie` của hai app. Phải cùng tên, cùng thuộc tính. Lúc logout, cookie rỗng vẫn có `Max-Age`, như Directus
   (contracts/auth-api.md §4).
5. Đăng nhập sai 3 lần xen kẽ hai app với `auth_login_attempts = 3` (đặt trong Directus, Settings) và
   `RATE_LIMITER_STORE=redis`: tới lần thứ 4 user bị `suspended`, như khi chỉ chạy Directus.
6. `POST "$B/auth/password/request"` với email của admin: trả `204`, log của app mới có dòng `[email] Password reset
   email to ...`, không có token.

## 3. Kiểm SSO bằng tay (profile `sso`)

Provider SSO và LDAP tạo user với role `d70c0943-5b55-4c5d-a613-f539a27a57f5` (`AUTH_<P>_DEFAULT_ROLE_ID`). Test tạo
role này rồi xóa khi xong, nên trước khi thử bằng tay hãy tạo nó qua Directus (đặt `TOKEN` là access token của admin):

```bash
curl -s -X POST http://127.0.0.1:8155/roles -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"id":"d70c0943-5b55-4c5d-a613-f539a27a57f5","name":"SSO users","icon":"person"}'
```

1. `curl -i "http://127.0.0.1:8956/auth/login/oidc?redirect=/admin/content"`: trả `302` tới IdP giả lập, có cookie
   `openid.oidc`.
2. Mở `Location` (đổi host `idp` thành `127.0.0.1:6110`) với tham số `user=<sub>` của IdP giả lập. IdP trả `302` về
   `.../auth/login/oidc/callback?code=...&state=...`.
3. Gọi callback ở **Directus** (8955) với cookie của bước 1: phải thành công. Đây là ca dùng chéo giữa hai instance
   (Nguyên tắc VII).
4. LDAP: OpenLDAP của profile khởi động trống (`sso-ldap.test.ts` tự tạo user rồi xóa). Tạo user thử rồi đăng nhập:

   ```bash
   printf 'dn: dc=my-domain,dc=com\nobjectClass: dcObject\nobjectClass: domain\ndc: my-domain\n\ndn: ou=users,dc=my-domain,dc=com\nobjectClass: organizationalUnit\nou: users\n\ndn: cn=ldaptestuser,ou=users,dc=my-domain,dc=com\nobjectClass: inetOrgPerson\ncn: ldaptestuser\nsn: TestUser\ngivenName: LDAP\nmail: ldaptestuser@example.com\nuid: ldaptestuser\nuserPassword: ldaptestpassword\n' | docker exec -i parity-postgres-ldap-1 ldapadd -c -x -D cn=Manager,dc=my-domain,dc=com -w secret
   ```

   ```bash
   curl -s -X POST http://127.0.0.1:8956/auth/login/ldap -H 'Content-Type: application/json' -d '{"identifier":"ldaptestuser","password":"ldaptestpassword"}'
   ```

## 4. Gỡ môi trường

```bash
pnpm nx run parity-tests:env-down --vendor=postgres
```
