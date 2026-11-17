Passkey cho phép đăng nhập không cần mật khẩu, bằng vân tay, khuôn mặt hoặc mã PIN của thiết bị (Touch ID, Windows
Hello, khóa bảo mật, trình quản lý mật khẩu). Đăng nhập bằng passkey thay cho cả mật khẩu lẫn mã xác thực hai bước.

## Ai dùng được

Người dùng đăng nhập bằng email và mật khẩu của chính Backoffice, đang ở trạng thái hoạt động. Người dùng SSO hay LDAP
không dùng được passkey.

## Điều kiện ở máy chủ

Passkey chỉ bật khi biến `PUBLIC_URL` là một URL đầy đủ có tên miền, ví dụ `https://backoffice.example.com` (không phải
địa chỉ IP). Người dùng phải mở app đúng địa chỉ đó. Xem [cấu hình chung](/docs/configuration/general#chung).

## Thêm passkey

1. Mở menu người dùng ở cuối thanh bên, chọn trang của bạn.
2. Kéo xuống thẻ **Passkey**, bấm **Thêm passkey**.
3. Nhập mật khẩu hiện tại để xác nhận.
4. Làm theo hộp thoại của trình duyệt (vân tay, khuôn mặt, PIN), rồi đặt tên cho passkey.

![Thẻ Passkey ở trang người dùng: nút Thêm passkey và bảng passkey đang trống](./images/passkey-2.png)

Mỗi người có tối đa 10 passkey. Trong thẻ, bạn đổi tên hoặc xóa passkey; admin xóa được passkey của người khác khi họ
mất thiết bị.

## Đăng nhập bằng passkey

1. Mở trang đăng nhập.
2. Bấm **Đăng nhập bằng Passkey** và xác nhận trên thiết bị.

![Trang đăng nhập với nút đăng nhập bằng passkey dưới nút đăng nhập bằng mật khẩu](./images/passkey-1.png)

## Giới hạn

- Trang thiết lập xác thực hai bước vẫn chỉ dùng mã OTP.
- Xóa passkey ở Backoffice không xóa nó khỏi thiết bị; hãy xóa cả trong thiết bị.

## Liên quan

- API: [đăng nhập bằng passkey](/docs/api/backoffice#dang-nhap-bang-passkey),
  [passkey của user hiện tại](/docs/api/backoffice#liet-ke-passkey-cua-user-hien-tai).
