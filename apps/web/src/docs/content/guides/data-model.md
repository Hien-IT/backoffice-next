**Mô hình dữ liệu** (trong Cài đặt) là nơi admin tạo collection và trường. Mỗi collection là một bảng của cơ sở dữ
liệu; mỗi trường là một cột, kèm cách nhập (interface) và cách hiện (display) trong app.

## Mở trang

1. Bấm ô **Cài đặt** trong khối module.
2. Chọn **Mô Hình Dữ Liệu** ở thanh bên.

![Trang Mô hình dữ liệu: danh sách collection gồm products, nhóm collection hệ thống ở cuối](./images/data-model-1.png)

## Tạo collection

1. Bấm nút **+**, nhập tên collection (chữ thường, không dấu, dùng dấu gạch dưới) và chọn kiểu khóa chính.
2. Chọn các trường hệ thống muốn có sẵn (trạng thái, người tạo, ngày tạo...) rồi lưu.
3. Kéo collection để xếp thứ tự trong menu Nội dung, hoặc đưa vào một thư mục.

## Thêm và sửa trường

1. Bấm một collection để mở trang của nó.
2. Bấm **Tạo thêm trường**, chọn loại (chữ, số, ngày, JSON, quan hệ...), đặt tên rồi cấu hình interface, display và
   các ràng buộc.
3. Kéo các trường để đổi thứ tự trên form; chọn độ rộng nửa hay cả dòng.
4. Bấm một trường để sửa; menu của trường có lệnh xóa. Xóa trường xóa luôn cột và dữ liệu của nó.

![Trang collection products: các trường id, status, name, sku, price, stock, min_stock và specs, cùng thẻ Index và các thẻ cài đặt](./images/data-model-2.png)

Bên dưới danh sách trường là các thẻ cài đặt của collection: hiển thị, bản dịch, lưu trữ, sắp xếp, và hai thẻ chỉ có ở
Backoffice: [Index](/docs/guides/collection-indexes) và
[Content: tìm kiếm, Import, Export](/docs/guides/collection-toggles).

> [!WARNING]
> Xóa collection xóa bảng và mọi dữ liệu trong đó. Không hoàn tác được.

## Liên quan

- API: [collection](/docs/api/collections#list-collections), [trường](/docs/api/fields#list-all-fields).
