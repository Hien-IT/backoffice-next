Với trường kiểu JSON, bộ lọc của module Nội dung lọc được theo một giá trị nằm bên trong JSON, ví dụ màu trong trường
Thông số `{"color": "đỏ", "weight": 260}`.

## Ai dùng được

Mọi người dùng đọc được trường JSON đó. Bộ lọc dùng được ở trang collection và trong ngăn chọn bản ghi.

## Các bước

1. Mở collection trong module **Nội dung**.
2. Bấm **Bộ lọc**, rồi **Thêm bộ lọc**.
3. Trong danh sách trường, mở trường JSON và chọn mục đường dẫn JSON của trường đó.
4. Nhập đường dẫn, ví dụ `color` hoặc `size.width`; dùng `tags[*]` để khớp khi bất kỳ phần tử nào của mảng thỏa điều
   kiện.
5. Chọn kiểu giá trị: chữ, số hoặc đúng/sai. Kiểu quyết định các phép so sánh có thể dùng.
6. Chọn phép so sánh và nhập giá trị.

![Collection Sản phẩm lọc theo Thông số › color (Chữ) bằng đỏ: còn một bản ghi Váy hoa nhí](./images/json-path-filter-1.png)

Lưu bộ lọc thành dấu trang để dùng lại.

## Qua API

Khóa của bộ lọc có dạng `json(truong, duong_dan, kieu)`, ví dụ:

```json
{ "json(specs, color)": { "_eq": "đỏ" } }
```

Xem [liệt kê bản ghi](/docs/api/items#list-items).

## Giới hạn

- Chỉ chạy trên PostgreSQL và SQLite; cơ sở dữ liệu khác trả lỗi.
- Không dùng được trong quyền của chính sách.
