Module **Thư viện tệp** chứa mọi file đã tải lên: ảnh, tài liệu, video. File được xếp trong thư mục, và mỗi file có
một trang riêng với ảnh xem trước, tiêu đề, mô tả, thẻ và thông tin kỹ thuật.

## Mở module

1. Bấm ô **Thư viện tệp** trong khối module.
2. Chọn một thư mục trong cây thư mục ở thanh bên, hoặc một mục đặc biệt: **Tất cả các tệp**, **Tập tin của tôi**,
   **Các tệp gần đây**.

![Thư viện tệp đang mở thư mục Ảnh sản phẩm: ba ảnh dạng thẻ, cây thư mục Tài liệu và Ảnh sản phẩm ở thanh bên](./images/files-1.png)

## Tải file lên

1. Mở thư mục cần tải file vào.
2. Kéo file từ máy vào danh sách, hoặc bấm nút **+** rồi chọn file. Trong hộp tải lên còn có thể nhập URL để lấy file từ
   một địa chỉ khác.
3. Chờ thanh tiến trình chạy hết; file hiện trong thư mục.

Khi máy chủ bật upload nối tiếp, file lớn bị ngắt giữa chừng sẽ tải tiếp từ chỗ dừng.

## Sửa và di chuyển file

1. Bấm một file để mở trang của nó.
2. Sửa tiêu đề, mô tả hay thẻ rồi bấm nút lưu.
3. Nút **Thay thế tập tin** đổi nội dung file mà giữ nguyên mã của nó, nên các chỗ đang dùng file vẫn đúng.
4. Nút di chuyển (biểu tượng thư mục) chuyển file sang thư mục khác; nút tải xuống lưu file về máy.
5. Với ảnh, nút chỉnh sửa (biểu tượng thanh trượt) mở trình cắt và xoay ảnh.

![Trang của một file ảnh: ảnh xem trước, nút Thay thế tập tin và form với trường Tiêu đề](./images/files-2.png)

## Thư mục

- Bấm **Tạo Thư mục** trong thanh bên để thêm thư mục; thư mục lồng nhau được.
- Xóa thư mục không xóa file: file trong đó lên thư mục cha.

## Liên quan

- API: [tải file lên](/docs/api/files#create-a-file), [liệt kê thư mục](/docs/api/folders#list-folders).
- Cấu hình: [nơi lưu trữ](/docs/configuration/files#noi-luu-tru), [giới hạn upload](/docs/configuration/files#upload),
  [upload nối tiếp](/docs/configuration/files#upload-noi-tiep-tus), [import từ URL](/docs/configuration/files#import-tu-url).
