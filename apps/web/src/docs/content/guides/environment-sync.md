Đồng bộ môi trường kéo cấu hình từ một môi trường Backoffice khác vào môi trường bạn đang dùng, ví dụ đứng ở môi
trường thử nghiệm kéo cấu hình đã duyệt từ môi trường phát triển. Cấu hình gồm data model, flow, vai trò và quyền,
cài đặt, bản dịch, dấu trang chung, dashboard, index, thư mục và trạng thái bật, tắt của extension. Dữ liệu (bản ghi,
file, người dùng) không được chép.

## Ai dùng được

Chỉ admin. Cần static token của một admin ở môi trường nguồn.

## Điều kiện

- Hai môi trường cùng phiên bản Backoffice và cùng danh sách migration.
- Máy chủ của môi trường đích gọi được tới URL của nguồn.
- URL và token không được lưu: tải lại trang là phải nhập lại.

## Các bước

1. Mở **Cài đặt** → **Đồng bộ môi trường**.
2. Nhập **URL nguồn** và **Static token admin của nguồn**; chọn các nhóm cần so sánh.
3. Bấm **So sánh**. Bảng hiện từng dòng cấu hình với trạng thái: khác nhau, chỉ ở nguồn, chỉ ở đây, giống nhau.
4. Mở một dòng để xem giá trị hai bên theo từng trường.
5. Tick các dòng cần lấy. Dòng chỉ ở đây được tick để xóa; các dòng bị xóa kèm được tick và khóa tự động.
6. Bấm **Áp dụng**, đọc hộp xác nhận (các dòng bị xóa, các flow sẽ chạy ngay) rồi xác nhận.

![Trang Đồng bộ môi trường sau khi so sánh: các nhóm cần so sánh, tab Khác biệt và bảng Data model với orders chỉ ở nguồn, products chỉ ở đây](./images/environment-sync-1.png)

## Khi có lỗi

- Mọi thay đổi của một lượt áp dụng nằm trong một transaction: lỗi giữa chừng thì không dòng nào được ghi.
- Nếu một trong hai môi trường đã đổi sau khi so sánh, lượt áp dụng bị từ chối; bấm **So sánh lại**.
- Thao tác làm mất quyền admin của chính bạn bị từ chối.

> [!WARNING]
> Token admin của nguồn đi qua trình duyệt và máy chủ đích ở mỗi lượt. Dùng URL `https` cho nguồn; `http` chỉ trong mạng
> nội bộ tin cậy.

## Liên quan

- Máy chủ đích chặn các địa chỉ trong [`IMPORT_IP_DENY_LIST`](/docs/configuration/files#import-tu-url).
- API: [so sánh](/docs/api/backoffice#so-sanh-cau-hinh-voi-mot-moi-truong-nguon),
  [áp dụng](/docs/api/backoffice#ap-dung-cac-dong-da-chon).
