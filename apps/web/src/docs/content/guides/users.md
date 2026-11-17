Module **Danh mục tài khoản** liệt kê người dùng theo trạng thái và theo vai trò. Admin mời người mới, sửa thông tin,
đổi vai trò hay tạm khóa tài khoản ở đây; mỗi người tự sửa trang của chính mình.

## Mở module

1. Bấm ô **Danh mục tài khoản** trong khối module.
2. Chọn một nhóm trong thanh bên: người dùng đang hoạt động, bị tạm khóa, đã được mời, tất cả, hoặc một vai trò.

![Danh mục tài khoản: bảng người dùng với tên, email và vai trò, thanh bên có các nhóm theo trạng thái và theo vai trò](./images/users-1.png)

## Mời người dùng

1. Bấm nút **+** ở góc trên, chọn **Mời Người dùng**.
2. Nhập email và chọn vai trò, rồi gửi lời mời.
3. Backoffice không gửi email: link mời được ghi vào log của máy chủ. Lấy link ở đó và chuyển cho người được mời.
4. Người được mời mở link, đặt mật khẩu và đăng nhập.

## Sửa một người dùng

1. Bấm một dòng để mở trang người dùng.
2. Sửa tên, email, vai trò, ngôn ngữ hay giao diện rồi bấm nút lưu.
3. Đổi **Trạng thái** sang tạm khóa để chặn đăng nhập mà vẫn giữ dữ liệu của người đó.
4. Ở trang của chính mình, bạn đặt mật khẩu mới, bật xác thực hai bước và thêm [passkey](/docs/guides/passkey).

![Trang người dùng Lan Nguyễn: thẻ tên với email và vai trò Biên tập viên, form với Tên, Họ, Địa chỉ email và Mật khẩu](./images/users-2.png)

## Liên quan

- Quyền của người dùng đến từ vai trò và chính sách truy cập: xem [Vai trò và chính sách](/docs/guides/roles-policies).
- API: [liệt kê người dùng](/docs/api/users#list-users), [mời người dùng](/docs/api/users#invite-user-s).
- Cấu hình: [link mời và đặt lại mật khẩu](/docs/configuration/auth#link-moi-dat-lai-mat-khau-va-dang-ky).
