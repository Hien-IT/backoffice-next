Module **Insights** dựng dashboard từ dữ liệu: số liệu tổng, biểu đồ theo thời gian, danh sách, nhãn. Mỗi dashboard là
một lưới các panel; mỗi panel đọc một collection theo quyền của người đang xem.

## Mở một dashboard

1. Bấm ô **Insights** trong khối module.
2. Chọn một dashboard trong danh sách hoặc trong thanh bên.

![Dashboard Bán hàng: hai panel số liệu Sản phẩm đang bán và Tổng tồn kho, một panel danh sách Sắp hết hàng](./images/insights-1.png)

## Tạo dashboard

1. Ở trang danh sách dashboard, bấm nút **+**, đặt tên và icon rồi lưu.
2. Mở dashboard vừa tạo, bấm nút sửa (biểu tượng bút) để vào chế độ sửa.
3. Bấm thêm panel, chọn loại panel (ví dụ Số liệu, Biểu đồ theo thời gian, Danh sách) và điền các tùy chọn: collection,
   trường, hàm tính, bộ lọc.
4. Kéo panel để đổi chỗ, kéo góc dưới để đổi kích thước.
5. Bấm lưu; mọi thay đổi của lượt sửa được ghi một lần.

## Biến của dashboard

Panel loại biến tạo một ô nhập (ví dụ chọn khoảng ngày) mà các panel khác dùng trong bộ lọc với cú pháp
`{{ ten_bien }}`. Đổi giá trị ô đó thì mọi panel dùng biến được tính lại.

> [!NOTE]
> Kéo và đổi kích thước panel chỉ làm được bằng chuột.

## Liên quan

- API: [dashboard](/docs/api/dashboards#liet-ke-dashboard), [panel](/docs/api/panels#liet-ke-panel).
