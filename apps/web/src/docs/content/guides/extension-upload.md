Ngoài marketplace, admin cài được extension từ một gói `.tgz` trên máy (gói tạo bằng `npm pack`), ví dụ extension do
đội của bạn viết.

## Ai dùng được

Chỉ admin.

## Các bước

1. Đóng gói extension: trong thư mục của extension chạy `npm pack`.
2. Mở **Cài đặt** → **Phần mở rộng**.
3. Bấm **Tải extension lên** ở góc trên.
4. Kéo file `.tgz` vào hộp, hoặc bấm **Chọn file .tgz**.
5. Bấm **Tải lên**. Extension hiện trong danh sách với nhãn **Đã tải lên**.

![Hộp thoại Tải extension lên: vùng thả file với nút Chọn file .tgz, nút Huỷ và Tải lên](./images/extension-upload-1.png)

## Máy chủ kiểm tra gì

- Gói đúng dạng và có tên chưa trùng với extension nào đã có.
- Khi `MARKETPLACE_TRUST` là `sandbox` (mặc định), chỉ nhận extension chạy trong sandbox hoặc chỉ chạy ở app.
- Số extension không vượt `EXTENSIONS_LIMIT`; gói không vượt `FILES_MAX_UPLOAD_SIZE`.

Xem [cấu hình extension](/docs/configuration/flows-extensions#extension) và
[marketplace](/docs/configuration/flows-extensions#marketplace).

## Gỡ và cài lại

Gỡ bằng menu của dòng extension. Muốn cài phiên bản mới, gỡ bản cũ rồi tải gói mới lên.

> [!WARNING]
> Extension chạy ở máy chủ. Chỉ tải lên gói bạn tin cậy.

## Liên quan

- API: [cài extension từ gói tải lên](/docs/api/backoffice#cai-extension-tu-goi-tai-len).
