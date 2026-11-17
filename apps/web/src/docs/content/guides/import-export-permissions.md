Ngoài đọc, tạo, sửa, xóa, mỗi chính sách truy cập có thêm hai quyền: **Import** và **Export** cho từng collection.
Người không có quyền này không thấy phần import, export ở module Nội dung, và máy chủ từ chối thao tác đó.

## Ai dùng được

Admin đặt quyền. Admin luôn import và export được.

## Đặt quyền

1. Mở **Cài đặt** → **Access Policies** và chọn chính sách.
2. Trong bảng **Permissions**, tìm dòng của collection.
3. Bấm ô **Import** hoặc **Export** và chọn:
   - **Toàn quyền**: import hoặc export mọi dòng, mọi trường;
   - **Cấm truy cập**: không được;
   - **Chọn lọc**: đặt bộ lọc dòng, các trường được dùng và các định dạng file (CSV, JSON, XML, YAML).
4. Bấm lưu chính sách.

![Bảng quyền của chính sách Biên tập: menu của ô Export ở dòng products với ba lựa chọn Toàn quyền, Cấm truy cập và Chọn lọc](./images/import-export-permissions-1.png)

## Cách tính

- Mỗi chính sách giữ bộ lọc, trường và định dạng của riêng nó. Một dòng import hợp lệ khi khớp trọn một quy tắc; một
  file import có dòng nằm ngoài bộ lọc hay có cột ngoài các trường được phép bị từ chối cả file.
- Export chỉ trả các dòng và trường người đó vừa được đọc vừa được export.
- Nếu admin đã [tắt Import hay Export của collection](/docs/guides/collection-toggles) thì không ai làm được, dù có
  quyền.

## Giới hạn

- Người dùng mới không có quyền import, export cho tới khi admin cấp.
- Quyền import, export không áp dụng cho link chia sẻ.

## Liên quan

- API: [quyền import, export](/docs/api/backoffice#liet-ke-quyen-import-export),
  [import](/docs/api/utilities#import-items), [export](/docs/api/utilities#export-items).
