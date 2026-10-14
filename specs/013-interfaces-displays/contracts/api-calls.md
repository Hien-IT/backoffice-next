# Contract: API mà form, interface, display và drawer gọi (FR-054, FR-081)

Bổ sung vào danh sách đóng của 012 (`specs/012-backoffice-web-shell/contracts/api-calls.md`). Test component ghi
lại mọi request qua `calls()`; test thất bại nếu có path ngoài hai bảng. `getEndpoint(collection)` như Directus:
`directus_<x>` → `/<x>`, còn lại `/items/<collection>`.

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 33 | GET | `/flows` | hydrate (`flowsStore`) | `fields=id,name,icon,color,status,trigger,options,accountability,operation` như Directus | R10, thu hẹp D-45 |
| 34 | GET | `<endpoint>` | `useItems` (drawer chọn item, danh sách quan hệ o2m/m2m/m2a/files/translations, list-m2a theo collection) | `fields[]`, `filter`, `search`, `sort`, `limit`, `page`, `meta`? không; Directus `useItems` gửi `fields`, `sort`, `limit`, `page`, `search`, `filter` | giống Directus app |
| 35 | GET | `<endpoint>` | `useItems` đếm | `aggregate[count]=*` (hoặc `aggregate[countDistinct]=<pk>` khi có filter quan hệ, như Directus) + `filter`, `search` | |
| 36 | GET | `<endpoint>?filter[<pk>][_eq]=<key>&fields=...` | m2o, file, file-image, collection-item-dropdown (`useRelationSingle`) | | |
| 37 | GET | `<endpoint>?filter[<pk>][_in]=...` | collection-item-multiple-dropdown | | |
| 38 | GET | `<endpoint>/<pk>?fields=...` | `presentation-links` (field quan hệ trong URL), `useTemplateData` (`header`) | | |
| 39 | GET | `/items/<languages>` | `translations` (`fetchAll`, `limit=-1`, `sort`) | | |
| 40 | GET | `/files?...` | `DrawerFiles` (`useItems` trên `directus_files`), `files` | filter mime, folder | |
| 41 | GET | `/assets/<id>?key=system-small-cover&cacheBuster=<modified_on>` | display `file`, `image`, `user`; interface `file`, `file-image`, `files` (`system-large-cover`/`contain`) | | thẻ `img`, không phải fetch |
| 42 | GET | `/assets/<id>.<ext>[?access_token=<imageToken>]` | rich text, markdown (URL chèn vào nội dung) | | |
| 43 | GET | `<url>` (bên ngoài) | `input-autocomplete-api` khi `url` không bắt đầu bằng `/`; bắt đầu bằng `/` → qua sdk | | FR-081 |
| 44 | GET | tile/style bản đồ | `map` (settings `basemaps` hoặc OpenStreetMap) | | ngoài |

Đã có ở 012: `/fields`, `/relations`, `/collections`, `/permissions/me`, `/presets`, `/settings`, `/users/me`.

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 45 | POST | `/files` | `BoUpload` (file, file-image, files, block editor, rich text, markdown) | multipart: `folder` (option), `title`?, `file` | cùng thứ tự field như `v-upload.vue` |
| 46 | PATCH | `/files/<id>` | `BoUpload` chế độ thay file (`fileId`) | multipart | chỉ khi màn chứa dùng; 013 không gọi (ImageEditor D-59) |
| 47 | POST | `/files/import` | file, file-image, files, `BoUpload` từ URL | `{ url, data: { folder }, options?: { filterMimeType } }` | |
| 48 | POST | `/flows/trigger/<id>` | `header`, `presentation-links` (flow thủ công) | `{ collection, keys: [pk], ...fields xác nhận }` | như `useRunManualFlow` Directus |

Không có request ghi khác từ 013. Lưu item (`POST|PATCH /items/<c>`) là việc của màn chứa (014). Drawer item
"stage on save" không gọi API: thay đổi gom vào `ChangesItem` của field cha.
