# Quickstart: Cài extension bằng gói `.tgz` tải lên (031)

## Bật

Không biến môi trường mới, không migration. Có sẵn khi API là Backoffice; nút ẩn khi API là Directus. Nên đặt:

- `MARKETPLACE_TRUST=sandbox` (mặc định) để chỉ nhận gói chạy trong sandbox; `MARKETPLACE_TRUST=all` cho phép gói
  chạy trực tiếp trong tiến trình API (mã tùy ý với quyền của tiến trình: chỉ admin tin cậy).
- `FILES_MAX_UPLOAD_SIZE` (ví dụ `50mb`): không đặt là không giới hạn.
- `EXTENSIONS_LOCATION` khi chạy nhiều replica: gói được chép lên kho dùng chung và mọi replica nạp qua bus; không có
  thì chỉ replica nhận tải lên có gói.

## Đóng gói

```bash
cd my-extension && npx directus-extension build && npm pack     # → my-extension-1.0.0.tgz
```

## Tải lên

Settings > Extensions → "Upload extension" → chọn file `.tgz` → Upload. Hàng mới hiện với chip "Uploaded"; endpoint,
hook, operation hay phần app chạy ngay (phần app sau khi tải lại trang).

Bằng API (token admin):

```bash
curl -H "Authorization: Bearer $TOKEN" -F "file=@my-extension-1.0.0.tgz" "$API/backoffice/extensions/upload"
# → 200 { "data": { "id": "<uuid>", "meta": { "source": "upload", "folder": "<uuid>", "enabled": true }, "schema": {...} } }
curl -H "Authorization: Bearer $TOKEN" "$API/backoffice/extensions/upload"      # → { "data": { "max_upload_size": null } }
```

Từ chối (400 `INVALID_PAYLOAD`, không để lại gì): không phải tar gzip, thiếu `package/package.json`, manifest sai, trùng
`name` với extension đã cài, gói không sandbox khi `MARKETPLACE_TRUST=sandbox`; 413 khi vượt `FILES_MAX_UPLOAD_SIZE`.

## Gỡ, đổi phiên bản

Menu của hàng → Uninstall (hoặc `DELETE /extensions/registry/uninstall/<id>`): xóa file ở local và kho, xóa dòng, mọi
replica nạp lại. Không nâng cấp tại chỗ: gỡ rồi tải gói mới lên (cấu hình bật/tắt mất như gỡ gói registry).

## Cạnh Directus cùng DB

Directus giữ dòng `directus_extensions` với `source: 'upload'`, liệt kê nó ở nhóm "Missing" và không chạy gói; thư mục
`.upload` là thư mục ẩn, Directus không quét. Không cần làm gì ở Directus (D-212.1).

## Gỡ tay

Xóa `<EXTENSIONS_PATH>/.upload/<id>` (ở kho dùng chung nếu có, và ở `<TEMP_PATH>/extensions/.upload/<id>` của từng
replica) và dòng `directus_extensions` có `id` đó (cùng các dòng `bundle = <id>`), rồi khởi động lại hoặc đợi lần reload.

## Kiểm thử

```bash
pnpm nx test api -- extensions                              # unit
TEST_DB=postgres pnpm nx run parity-tests:parity -- --profile extensions src/extensions/upload.test.ts
pnpm nx run parity-tests:deploy -- extension-upload         # 3 replica
pnpm nx e2e web-e2e -- settings-extensions-upload           # ba cấu hình theo PARITY_WEB_*
```
