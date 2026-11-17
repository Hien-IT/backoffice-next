Phần bổ sung OpenAPI chỉ dùng cho tài liệu (spec 033, FR-022, FR-023). Script `apps/web/scripts/sync-docs-api.mjs`
gộp các file `*.yaml` ở đây với mô tả API tĩnh của `libs/specs` và ghi `../generated/`. Mô tả API mà máy chủ trả ở
`/server/specs/oas` không đọc các file này.

Mỗi file là một mảnh OpenAPI 3 (`tags`, `paths`, `components.schemas`) với ba phần mở rộng:

- `x-crud` trên một tag: sinh bảy thao tác chuẩn của một collection hệ thống (liệt kê, lấy một, tạo, sửa nhiều, sửa
  một, xóa nhiều, xóa một) với tên `path`, `id` (`singular`, `plural`) và danh từ tiếng Việt `noun`.
- `x-backoffice-only: true` trên một tag: mọi thao tác của tag chỉ có khi máy chủ là Backoffice.
- `x-access` trên một thao tác: ai gọi được (`admin`, `authenticated`, `public`).

Văn bản viết tiếng Việt (`x-lang` mặc định `vi`). Không viết từ thương hiệu bị cấm (FR-047).

Bản tiếng Anh (`../generated/en/`): `x-crud` có thêm `noun-en` (`singular`, `plural`) cho tên bảy thao tác chuẩn; mọi văn
bản khác đi qua `en.json` (văn bản tiếng Việt → tiếng Anh). `node apps/web/scripts/sync-docs-api.mjs --missing` in các
văn bản còn thiếu; script dừng khi bản tiếng Anh còn chữ tiếng Việt.
