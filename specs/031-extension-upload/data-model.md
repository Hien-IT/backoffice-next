# Data Model: Cài extension bằng gói `.tgz` tải lên (031)

Không bảng mới, không cột mới, không migration. Dữ liệu của feature là dòng `directus_extensions` có sẵn với một giá trị
`source` mới và một thư mục ẩn mới trong kho extension.

## Dòng `directus_extensions` (có sẵn, Directus 11.17.4)

| Cột | Kiểu | Giá trị với gói tải lên |
|-----|------|-------------------------|
| `id` | uuid | `randomUUID()` (v4, collection hệ thống, 027) sinh ở API trước khi chép file; cũng là tên thư mục |
| `enabled` | boolean | `true` lúc tạo; bật/tắt như gói registry (`PATCH /extensions/:pk`) |
| `folder` | string(255) | `= id` (gói cấp cao); với entry của bundle: tên entry (`entries[].name`) như registry |
| `source` | string(255) | **`upload`** (mới; Directus chỉ dùng `local`, `registry`, `module`; cột không có ràng buộc giá trị) |
| `bundle` | uuid null | `null` cho gói cấp cao; `id` cha cho entry của bundle |

Kiểu `ExtensionSettings.source` trong `libs/types` thêm `'upload'`. Không unique `(source, folder)` ở DB (như Directus):
loại trừ hai dòng cùng gói bằng `withSettingsLock` (research R5).

## Thư mục

```text
<EXTENSIONS_PATH>/                         # local; = <TEMP_PATH>/extensions khi có EXTENSIONS_LOCATION (bản sao sync)
├── <folder>/                              # source local (quét bỏ thư mục bắt đầu bằng ".")
├── .registry/<versionId>/                 # source registry (Directus và Backoffice quét)
└── .upload/<id>/                          # source upload (mới; chỉ Backoffice quét; Directus bỏ qua vì ẩn)
    ├── package.json
    └── dist/…
<EXTENSIONS_LOCATION>:<EXTENSIONS_PATH>/.upload/<id>/…   # kho dùng chung, cùng cấu trúc; nguồn cho sync của mọi replica
<TEMP_PATH>/upload-extensions/<id>/        # thư mục tạm khi giải nén: bin.tar.tgz + package/; xóa ở finally
```

## Gói tải lên (không lưu, chỉ kiểm)

| Thuộc tính | Nguồn | Luật |
|------------|-------|------|
| định dạng | bytes | tar + gzip giải được bằng `tar` 7; thư mục gốc `package/` có `package.json` |
| `name`, `version` | `package.json` | `name` không trùng extension đã cài ở mọi source (400); hiển thị thay tên file |
| `directus:extension` | `package.json` | hợp lệ theo `ExtensionManifest` (type, path, host, sandbox) |
| `sandbox.enabled` | manifest | khi `MARKETPLACE_TRUST=sandbox` phải `true` cho gói có phần API (400) |
| `host` | manifest | không kiểm (clarify Q1); log cảnh báo khi nạp nếu không khớp |
| kích thước | stream | ≤ `FILES_MAX_UPLOAD_SIZE` nếu đặt (413) |
| số lượng | `EXTENSIONS_LIMIT` | như registry: `extensions.length + điểm ≥ limit` → `LimitExceededError` |

## Vòng đời

```text
POST upload ──giải nén + kiểm──▶ file ở .upload/<id> (local + kho) ──lock──▶ dòng (source upload, enabled)
           ──bus partialSync──▶ mọi replica sync .upload/<id> và reload ──▶ endpoint/hook/app chạy
PATCH /extensions/:id {enabled}  ──▶ bật/tắt (bus reload như registry)
DELETE /extensions/registry/uninstall/:id ──▶ xóa dòng (+ entry) ──▶ xóa .upload/<id> (kho + local) ──bus──▶ replica xóa + reload
thư mục không có dòng (khởi động) ──▶ tạo dòng bật, source upload (như local), không gọi Marketplace
dòng không có thư mục ──▶ giữ, GET /extensions trả schema null ("Missing"); DELETE /extensions/:id xóa dòng
```

Lỗi ở bất kỳ bước nào trước "dòng": xóa thư mục tạm và thư mục `.upload/<id>` đã chép (kho + local); không dòng.

## Ở Directus cùng DB (D-212.1, đọc code 2026-11-04, FR-023 đo thật)

| Chỗ | Hành vi với `source: 'upload'` |
|-----|-------------------------------|
| `getExtensionsSettings` | không lọc, không xóa, không tạo thêm |
| `GET /extensions` | dòng với `schema: null`; entry bundle bị bỏ vì cha `schema: null` |
| app Directus | nhóm "Missing", chip cảnh báo, Uninstall khóa, không Reinstall, Remove xóa dòng |
| nạp | không (ba map) |
| kho `.upload/` | không quét (thư mục ẩn, không có nhánh `.upload`); sync đầy đủ của Directus (cùng code) chép `.upload/…` về bản sao local của nó: vô hại (checklist 2026-11-04) |
