Admin ẩn được ô tìm kiếm, phần import và phần export của từng collection trong module Nội dung. Khi một phần bị ẩn,
máy chủ cũng từ chối thao tác tương ứng qua API, với mọi người kể cả admin.

## Ai dùng được

Chỉ admin đổi được cài đặt này. Cài đặt áp dụng cho mọi người dùng của collection.

## Bật hoặc tắt

1. Mở **Cài đặt** → **Mô Hình Dữ Liệu** và chọn collection.
2. Kéo xuống thẻ **Content: tìm kiếm, Import, Export**.
3. Bỏ chọn **Hiện ô tìm kiếm**, **Hiện Import** hoặc **Hiện Export**.
4. Bấm lưu ở góc trên.

![Thẻ Content: tìm kiếm, Import, Export của collection products với ba tùy chọn Hiện ô tìm kiếm, Hiện Import và Hiện Export đều đang bật](./images/collection-toggles-1.png)

## Hiệu lực

- **Ô tìm kiếm tắt**: trang collection không có ô tìm kiếm (nút lọc vẫn còn); API trả lỗi quyền khi request có tham
  số `search`, cả ở REST lẫn GraphQL.
- **Import tắt**: không còn phần import ở thanh bên; API từ chối import file vào collection này.
- **Export tắt**: không còn phần export và link tải CSV; API từ chối export collection này.

## Giới hạn

- Cài đặt theo collection, không theo vai trò. Muốn cho một số người import, export mà người khác không, dùng
  [quyền import, export theo chính sách](/docs/guides/import-export-permissions).
- Lỗi trả về giống lỗi không có quyền, để không lộ việc collection có tồn tại hay không.
