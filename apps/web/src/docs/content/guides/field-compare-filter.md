Bộ lọc của module Nội dung so sánh được hai trường của cùng một bản ghi, ví dụ tìm sản phẩm có **Tồn kho** nhỏ hơn
**Tồn tối thiểu**, thay vì so với một giá trị cố định.

## Ai dùng được

Mọi người dùng đọc được cả hai trường.

## Các bước

1. Mở collection trong module **Nội dung**.
2. Bấm **Bộ lọc**, **Thêm bộ lọc**, chọn trường thứ nhất (ví dụ Tồn kho).
3. Chọn phép so sánh: bằng, khác, lớn hơn, lớn hơn hoặc bằng, nhỏ hơn, nhỏ hơn hoặc bằng.
4. Ở ô giá trị, bấm nút so sánh với một trường (biểu tượng hai mũi tên) và chọn trường thứ hai (ví dụ Tồn tối thiểu).
   Ô giá trị đổi thành nhãn tên trường.
5. Để quay lại nhập giá trị, bấm nhãn đó và chọn nhập giá trị.

![Collection Sản phẩm lọc theo Tồn kho nhỏ hơn Tồn tối thiểu: còn ba bản ghi Áo sơ mi linen, Váy hoa nhí và Khăn len](./images/field-compare-filter-1.png)

## Qua API

Giá trị so sánh viết `$FIELD(ten_truong)`:

```json
{ "stock": { "_lt": "$FIELD(min_stock)" } }
```

Xem [liệt kê bản ghi](/docs/api/items#list-items).

## Giới hạn

- Hai trường phải cùng nhóm kiểu: số với số, chữ với chữ; ngày giờ chỉ so với cùng kiểu ngày giờ.
- Trường chữ, mã định danh và đúng/sai chỉ có phép bằng và khác.
- Bản ghi có một trong hai trường trống không bao giờ khớp.
- Không dùng được trong quyền của chính sách.
