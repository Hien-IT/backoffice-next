**Flows** tự động hóa công việc: khi một sự kiện xảy ra (bản ghi được tạo hay sửa, một lịch chạy, một webhook, hay
người dùng bấm nút), flow chạy một chuỗi bước (operation) như kiểm tra điều kiện, đọc hay ghi dữ liệu, gọi một URL,
gửi thông báo.

## Mở trang

1. Bấm ô **Cài đặt** trong khối module.
2. Chọn **Flows** ở thanh bên. Bảng liệt kê các flow với trạng thái bật hay tắt.

## Tạo flow

1. Bấm nút **+**, đặt tên và icon.
2. Chọn kiểu kích hoạt: sự kiện, lịch (biểu thức cron), webhook, chạy tay, hoặc gọi từ flow khác; điền tùy chọn của
   kiểu đó (ví dụ collection và loại sự kiện).
3. Lưu để mở canvas của flow.

## Thêm bước

1. Trên canvas, bấm nút sửa (biểu tượng bút).
2. Bấm vào điểm nối của một bước, chọn loại operation và điền tùy chọn. Đường xanh là nhánh thành công, đường đỏ là
   nhánh lỗi.
3. Kéo các bước để sắp xếp trên lưới.
4. Bấm lưu; mọi thay đổi của lượt sửa được ghi một lần.

![Canvas của flow Cảnh báo hàng sắp hết: kích hoạt khi sửa sản phẩm, bước Kiểm tra tồn kho, rồi bước Ghi log](./images/flows-1.png)

## Xem log

Thanh bên phải của flow có mục log: mỗi lần chạy ghi dữ liệu vào, ra của từng bước.

> [!NOTE]
> Operation gửi email chạy đủ các bước nhưng không gửi thư: Backoffice ghi nội dung vào log của máy chủ.

> [!WARNING]
> Flow kích hoạt bằng sự kiện chạy với mọi thay đổi khớp điều kiện, kể cả thay đổi do import hay do flow khác.

## Liên quan

- Biến môi trường flow đọc được qua `$env`, giới hạn của operation chạy script:
  [Flows](/docs/configuration/flows-extensions#flows).
- API: [flow](/docs/api/flows#list-flows), [operation](/docs/api/operations#list-operations).
