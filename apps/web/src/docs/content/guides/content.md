Module **Nội dung** là nơi làm việc hằng ngày với dữ liệu: mỗi collection (bảng) do admin tạo ở Mô hình dữ liệu hiện
thành một mục ở menu bên trái, và mỗi dòng của bảng là một bản ghi bạn xem, tạo, sửa hay xóa được. Bạn chỉ thấy các
collection và các trường mà vai trò của bạn được đọc.

## Mở module

1. Bấm ô **Nội dung** trong khối module ở đầu thanh bên.
2. Chọn một collection trong menu bên trái, ví dụ **Sản phẩm**. Các dấu trang (bookmark) của collection nằm ngay dưới
   tên collection.

![Danh sách collection Sản phẩm ở dạng bảng: các cột Tên sản phẩm, Giá, Mã SKU và Trạng thái, thanh tìm kiếm và nút lọc ở góc trên](./images/content-1.png)

## Xem, tìm và lọc

- **Tìm kiếm**: gõ vào ô tìm kiếm ở góc trên; danh sách lọc theo mọi trường chữ.
- **Lọc**: bấm nút **Bộ lọc**, chọn **Thêm bộ lọc**, chọn trường, phép so sánh và giá trị. Có thể ghép nhiều điều kiện
  bằng nhóm "và", "hoặc".
- **Bố cục**: mở thanh bên phải (nút **i**) để đổi bố cục giữa bảng, thẻ, lịch, kanban và bản đồ, chọn cột và cách sắp
  xếp.
- **Dấu trang**: sau khi lọc, bấm biểu tượng dấu trang cạnh tiêu đề để lưu cách xem này với một tên; dấu trang hiện
  trong menu bên trái.

Hai kiểu lọc chỉ có ở Backoffice được mô tả ở trang riêng: [lọc theo đường dẫn trong field JSON](/docs/guides/json-path-filter)
và [so sánh hai field](/docs/guides/field-compare-filter).

## Tạo, sửa, xóa bản ghi

1. Bấm nút **+** ở góc trên để tạo bản ghi mới, hoặc bấm một dòng để mở bản ghi.
2. Điền các trường của form. Trường có dấu `*` là bắt buộc.
3. Bấm nút lưu (dấu tích) ở góc trên. Mũi tên cạnh nút lưu có thêm các cách lưu: lưu và tạo bản mới, lưu thành bản
   sao.
4. Để xóa, mở bản ghi rồi bấm biểu tượng thùng rác, hoặc chọn nhiều dòng trong danh sách rồi bấm xóa.

![Trang một bản ghi: form với Trạng thái, Tên sản phẩm, Mã SKU, Giá, Tồn kho, Tồn tối thiểu và trường Thông số dạng JSON](./images/content-2.png)

Thanh bên phải của trang bản ghi có lịch sử sửa (revision), bình luận, các flow chạy tay và mục so sánh phiên bản.

> [!NOTE]
> Admin có thể ẩn ô tìm kiếm, phần import hay phần export của từng collection: xem
> [Ẩn hiện tìm kiếm, import, export](/docs/guides/collection-toggles).

## Liên quan

- API: [liệt kê bản ghi](/docs/api/items#list-items), [tạo bản ghi](/docs/api/items#create-an-item).
- Cấu hình: số bản ghi mặc định và tối đa mỗi trang ở
  [Giới hạn truy vấn và người dùng](/docs/configuration/security#gioi-han-truy-van-va-nguoi-dung).
