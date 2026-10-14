# Contract: API mà form, interface, display và drawer gọi (FR-054, FR-081)

Bổ sung vào danh sách đóng của 012 (`specs/012-backoffice-web-shell/contracts/api-calls.md`). Test component ghi
lại mọi request qua `calls()`; test thất bại nếu có path ngoài hai bảng. `getEndpoint(collection)` như Directus:
`directus_<x>` → `/<x>`, còn lại `/items/<collection>`.

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 33 | GET | `/flows` | hydrate (`flowsStore`, chỉ khi có quyền đọc `directus_flows`) | `fields=*,operations.*&limit=-1` như `stores/flows.ts` Directus | R10, thu hẹp D-45 |
| 34 | GET | `<endpoint>` | `useItems` (drawer chọn item, danh sách quan hệ o2m/m2m/m2a/files/translations, list-m2a theo collection) | `fields`, `sort`, `limit`, `page`, `search`, `filter` (như `useItems` Directus; không gửi `meta`) | giống Directus app |
| 35 | GET | `<endpoint>` | `useItems` đếm | `aggregate={"countDistinct":"<pk>"}` (không có khóa chính thì `count:*`) + `filter`, `search`; SDK gửi `aggregate`, `filter` dạng JSON, Directus app (axios) gửi dạng ngoặc `aggregate[countDistinct]=<pk>`; API đọc cả hai như nhau | `notifications` của 012 đã dùng dạng JSON |
| 36 | GET | `<endpoint>/<encodeURIComponent(key)>?fields=...` | m2o, file, file-image (`useRelationSingle`, như Directus 11.17.4; nhánh 403 dựa vào dạng này); `collection-item-dropdown` dùng `<endpoint>?filter[<pk>][_eq]=<key>` | | |
| 37 | GET | `<endpoint>?filter[<pk>][_in]=...` | collection-item-multiple-dropdown | | |
| 38 | GET | `<endpoint>/<pk>?fields=...` | `presentation-links` (field quan hệ trong URL), `useTemplateData` (`header`) | | |
| 39 | GET | `/items/<languages>` | `translations` (`fetchAll`, `limit=-1`, `sort`) | | |
| 40 | GET | `/files?...` | `DrawerFiles` (`useItems` trên `directus_files`), `files` | filter mime, folder | |
| 40b | GET | `/folders?sort=name&limit=-1` | `DrawerFiles` (danh sách thư mục, như `drawer-files.vue`) | | lần mở đầu |
| 41 | GET | `/assets/<id>?key=system-small-cover&cacheBuster=<modified_on>` | display `file`, `image`, `user`; interface `file`, `file-image`, `files` (`system-large-cover`/`contain`) | | thẻ `img`, không phải fetch |
| 42 | GET | `/assets/<id>.<ext>[?access_token=<imageToken>]` | rich text, markdown (URL chèn vào nội dung) | | |
| 43 | GET | `<url>` (bên ngoài) | `input-autocomplete-api` khi `url` không bắt đầu bằng `/` (`credentials: 'omit'`, không header phiên); bắt đầu bằng `/` → qua sdk | | FR-081 |
| 44 | GET | tile/style bản đồ | `map`: tile `basemaps` hoặc OpenStreetMap; glyph `https://fonts.openmaptiles.org/{fontstack}/{range}.pbf`; style và geocoder Mapbox khi có `mapbox_key` | | ngoài, FR-081 |
| 44b | GET (iframe) | URL embed | tool `embed` của block editor, media của rich text | | ngoài, FR-081 |
| 49 | GET | `/users/<id>?fields=id,first_name,last_name,avatar.id,avatar.modified_on,role.name,status,email` | popover của display `user` (`user-popover.vue`) | | lỗi quyền hiện như Directus |

Đã có ở 012: `/fields`, `/relations`, `/collections`, `/permissions/me`, `/presets`, `/settings`, `/users/me`.

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 45 | POST | `/files` | `BoUpload` (file, file-image, files, block editor, rich text, markdown) | multipart: `folder` (option), `title`?, `file` | cùng thứ tự field như `v-upload.vue` |
| 47 | POST | `/files/import` | file, file-image, files, `BoUpload` từ URL | `{ url, data: { folder }, options?: { filterMimeType } }` | |
| 48 | POST | `/flows/trigger/<id>` | `header`, `presentation-links` (flow thủ công) | `{ collection, keys: [pk], ...fields xác nhận }` | như `useRunManualFlow` Directus |

Không có request ghi khác từ 013. Lưu item (`POST|PATCH /items/<c>`) là việc của màn chứa (014). Drawer item
"stage on save" không gọi API: thay đổi gom vào `ChangesItem` của field cha.
