**Phần mở rộng** (extension) thêm chức năng cho Backoffice: interface và display mới cho trường, panel mới cho
dashboard, module mới, operation mới cho flow, endpoint và hook ở máy chủ. Trang Phần mở rộng liệt kê các extension đã
cài, nhóm theo loại.

## Mở trang

1. Bấm ô **Cài đặt** trong khối module.
2. Chọn **Phần mở rộng** ở thanh bên.

![Trang Phần mở rộng: nhóm Panels có extension parity-panel-counter phiên bản 1.0.0, nhãn Đã tải lên và Đã kích hoạt](./images/extensions-1.png)

## Bật, tắt và gỡ

1. Bấm menu (dấu ba chấm) ở cuối dòng của extension.
2. Chọn tắt hoặc bật. Extension bị tắt không chạy và không hiện trong app.
3. Với extension cài từ marketplace hoặc tải lên, menu có thêm lệnh gỡ.

## Cài extension

- Từ **Cửa hàng** (marketplace) ở thanh bên: tìm extension, mở trang của nó và bấm cài.
- Từ một gói `.tgz` trên máy: xem [Tải extension lên](/docs/guides/extension-upload).

> [!WARNING]
> Extension chạy ở máy chủ với quyền của tiến trình API. Chỉ cài extension bạn tin cậy.

## Liên quan

- Cấu hình: [thư mục, sandbox và giới hạn của extension](/docs/configuration/flows-extensions#extension),
  [marketplace](/docs/configuration/flows-extensions#marketplace).
- API: [danh sách extension](/docs/api/extensions#list-extensions).
