Quyền trong Backoffice gồm hai lớp. **Chính sách truy cập** (policy) chứa các quyền: được đọc, tạo, sửa, xóa collection
nào, theo bộ lọc nào, những trường nào. **Vai trò** (role) gom nhiều chính sách và được gán cho người dùng. Một người
cũng có thể được gắn chính sách trực tiếp.

## Mở trang

1. Bấm ô **Cài đặt** trong khối module.
2. Chọn **Vai trò người dùng** hoặc **Access Policies** ở thanh bên.

## Tạo vai trò

1. Ở trang Vai trò người dùng, bấm nút **+**, đặt tên và icon.
2. Trong vai trò, thêm các chính sách cần có và các người dùng thuộc vai trò.
3. Bấm lưu.

![Trang vai trò Biên tập viên: danh sách chính sách gồm Biên tập và danh sách người dùng của vai trò](./images/roles-policies-1.png)

## Đặt quyền trong một chính sách

1. Ở trang Access Policies, mở một chính sách hoặc tạo mới.
2. Bật các cờ của chính sách nếu cần: được vào app, quyền admin, bắt buộc xác thực hai bước.
3. Trong bảng **Permissions**, thêm collection rồi bấm từng ô hành động: **Toàn quyền**, **Cấm truy cập**, hoặc
   **Chọn lọc** để đặt bộ lọc dòng, các trường được dùng và giá trị mặc định.
4. Bấm lưu.

![Trang chính sách Biên tập: bảng quyền với dòng products có Đọc và Cập nhật được bật, cột Import và Export](./images/roles-policies-2.png)

Hai cột **Import** và **Export** của bảng quyền chỉ có ở Backoffice: xem
[Quyền import, export theo chính sách](/docs/guides/import-export-permissions).

> [!NOTE]
> Không xóa được chính sách admin cuối cùng; Backoffice luôn giữ ít nhất một admin.

## Liên quan

- API: [vai trò](/docs/api/roles#list-roles), [chính sách](/docs/api/policies#liet-ke-chinh-sach-truy-cap),
  [quyền](/docs/api/permissions#list-permissions).
