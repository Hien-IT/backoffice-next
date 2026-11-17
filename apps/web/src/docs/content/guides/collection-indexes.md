Index giúp cơ sở dữ liệu tìm và sắp xếp nhanh trên các collection lớn. Backoffice cho admin tạo index ghép trên nhiều
trường và index tìm kiếm cho `?search=`, ngay từ trang collection, không cần vào cơ sở dữ liệu.

## Ai dùng được

Chỉ admin.

## Tạo index

1. Mở **Cài đặt** → **Mô Hình Dữ Liệu** và chọn collection.
2. Ở thẻ **Index**, bấm **Thêm index**.
3. Chọn từ 1 tới 8 trường, theo thứ tự cột hay lọc chung nhất trước.
4. Chọn loại: **B-tree** cho lọc và sắp xếp; **trigram** cho tìm kiếm chữ (chỉ PostgreSQL, một trường chữ). Đánh dấu
   **Duy nhất** nếu tổ hợp giá trị không được trùng.
5. Bấm tạo. Index được dựng nền; trạng thái đổi từ đang tạo sang sẵn sàng.

![Thẻ Index của collection products: một index products_status_stock_index trên Trạng thái và Tồn kho, loại B-tree](./images/collection-indexes-1.png)

## Lưu ý

- Mặc định index được dựng mà không khóa bảng (PostgreSQL, MySQL), nên app vẫn dùng bình thường trong lúc dựng.
- `?search=` tìm trên mọi trường chữ: mỗi trường cần một index trigram riêng.
- Xóa một trường xóa luôn các index có trường đó; hộp xác nhận liệt kê chúng.
- Index duy nhất làm thao tác ghi có giá trị trùng bị từ chối với lỗi trùng.

## Liên quan

- API: [liệt kê index](/docs/api/backoffice#liet-ke-index-cua-mot-collection),
  [tạo index](/docs/api/backoffice#tao-index-cho-mot-collection).
