# Quickstart: Đăng nhập bằng Passkey (WebAuthn) cho user local (029)

## Bật

Không biến môi trường mới. Cần:

1. `PUBLIC_URL` tuyệt đối với hostname là tên miền (không IP), ví dụ `https://bo.example.com` hoặc `http://localhost:8091`;
   không thì mọi endpoint passkey trả 404 và app web không hiện nút (log `warn` lúc khởi động).
2. HTTPS (trừ `localhost`): trình duyệt chỉ cho WebAuthn ở secure context.
3. `bootstrap` (hoặc `init`) đã chạy sau khi nâng cấp: migration riêng `20261101A` tạo `backoffice_passkeys`; `start`
   trên DB thiếu migration dừng với lỗi như 022.
4. Nhiều replica: Redis (challenge dùng chung); không Redis = một instance.

Đổi domain (`PUBLIC_URL`) là passkey đã đăng ký không dùng được nữa; người dùng đăng ký lại.

## Thêm passkey (user local)

Đăng nhập bằng mật khẩu → menu user → trang của mình → card "Passkeys" → "Thêm passkey" → nhập mật khẩu → xác nhận trên
hộp thoại của trình duyệt → đặt tên → Lưu.

Bằng API (session cookie của user):

```bash
# 1. challenge đăng ký (cần mật khẩu)
curl -b cookies.txt -H 'Content-Type: application/json' -d '{"password":"…"}' "$API/backoffice/users/me/passkeys/options"
# 2. trình duyệt: navigator.credentials.create(options) → RegistrationResponseJSON
# 3. lưu
curl -b cookies.txt -H 'Content-Type: application/json' -d '{"response":{…},"name":"MacBook Pro"}' "$API/backoffice/users/me/passkeys"
```

## Đăng nhập bằng passkey

Trang login → "Đăng nhập bằng Passkey" → chọn tài khoản trong hộp thoại của trình duyệt → vào app. Không email, không
mật khẩu, không OTP (kể cả khi TFA bật hoặc role bắt buộc TFA).

Bằng API:

```bash
curl -X POST "$API/backoffice/auth/passkey/login/options"      # → PublicKeyCredentialRequestOptionsJSON
# trình duyệt: navigator.credentials.get(options) → AuthenticationResponseJSON
curl -c cookies.txt -H 'Content-Type: application/json' -d '{"response":{…},"mode":"session"}' "$API/backoffice/auth/passkey/login"
```

Response và cookie y hệt `POST /auth/login` cùng `mode`.

## Quản lý

| Việc | Ai | Đường |
|------|----|-------|
| Xem, đổi tên, xóa passkey của mình | user local | card "Passkeys" trên trang của mình; `GET/PATCH/DELETE /backoffice/users/me/passkeys(/:id)` |
| Xóa passkey của user khác (mất thiết bị, nghỉ việc) | admin | trang user đó, card "Passkeys", nút xóa; `DELETE /backoffice/users/:pk/passkeys/:id` |
| Xóa user | admin | passkey xóa theo |

Giới hạn 10 passkey một user. Đăng nhập passkey sai đếm vào `auth_login_attempts` như sai mật khẩu.

## Chạy test

```bash
pnpm nx run api:test -- passkey                                 # unit API
pnpm nx run web:test:unit -- passkey                            # unit web
TEST_DB=postgres pnpm nx run parity-tests:parity -- auth/passkey # parity (cặp chính)
E2E_CONFIG=proxy-api pnpm nx run web-e2e:e2e -- --project chromium-1280 passkey   # E2E (profile web với replica passkey)
```

## Cấu hình dev

`PUBLIC_URL=http://localhost:8055` (hoặc cổng API dev) để RP ID là `localhost`; mở app ở `http://localhost:4200`? **Không**:
origin phải là origin của `PUBLIC_URL`, nên dev dùng app build qua API (`/admin` của API) hoặc trỏ Vite proxy và đặt
`PUBLIC_URL=http://localhost:4200`.
