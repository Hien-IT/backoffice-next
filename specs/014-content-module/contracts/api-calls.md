# Contract: API mà module Content gọi (FR-112, SC-008)

Bổ sung vào danh sách đóng của 012 (#1–#32) và 013 (#33–#49). `apps/web-e2e/src/helpers/allowed-paths.ts` và
`KNOWN_REQUESTS` của `test-utils/fetch.ts` thêm các dòng dưới; test thất bại nếu có path ngoài danh sách.
`<endpoint>` = `getEndpoint(collection)` (`directus_<x>` → `/<x>`, còn lại `/items/<collection>`). Query gửi dạng JSON
của sdk (API đọc như dạng ngoặc của axios, 013 #35).

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 50 | GET | `<endpoint>` | `useItems` của 5 layout, drawer chọn item | `limit`, `page`, `fields`, `alias`, `sort`, `search`, `filter` (user + archive), `deep` | như 013 #34; calendar/kanban/map `limit` 1000 hoặc `queryLimit.max` |
| 51 | GET | `<endpoint>` | `useItems` đếm | `aggregate={"countDistinct":"<pk>"}` + `filter`,`search` (itemCount) hoặc chỉ `filterSystem` (totalCount) | 013 #35; không khóa chính → `count:*` |
| 52 | GET | `<endpoint>/<pk>` | màn item (`use-item`), `use-template-data` (tiêu đề, preview_url) | `fields=*` (+ field template); `version=<key>&versionRaw=true` khi ở version | singleton: `<endpoint>` |
| 53 | GET | `/permissions/me/<collection>/<pk>` | `useItemPermissions` (`fetchItemPermissions`) | | như Directus [Unverified route chính xác: T003] |
| 54 | GET | `/presets` | hydrate (012 #?) | theo user, role, global | đã có |
| 55 | GET | `/revisions` | Revisions sidebar, so sánh revision, `fetchLatestRevisionActivityOfMainVersion` | `filter{collection,item,version}`, `sort -id`, `limit 10`, `page`, `fields` như `use-revisions.ts`; `aggregate count` cho số đếm; `limit 1` cho activity mới nhất | |
| 56 | GET | `/revisions/<id>` | so sánh revision (`use-revision.ts`) | `fields` data, delta, activity | |
| 57 | GET | `/versions` | `useVersions` | `filter{collection,item}`, `sort -date_created`, `fields *` | |
| 58 | GET | `/versions/<id>/compare` | hộp so sánh version | | `{outdated, mainHash, current, main}` |
| 59 | GET | `/comments` | Comments sidebar | `filter{collection,item}`, `sort -date_created`, `fields` user_created...; `aggregate count id` | |
| 60 | GET | `/users` | mention preview, gợi ý `@`, so sánh (`fetchUserDetails` `/users/<id>`) | `filter id _in` / `search`, `fields` | |
| 61 | GET | `/shares` | Shares sidebar | `filter{collection,item}`, `sort name`; `aggregate count id` | |
| 62 | GET | `/flows` | hydrate (013 #33) | | đã có |
| 63 | GET | `<endpoint>?export=<csv\|json\|xml\|yaml>` | xuất tải về | `limit`, `fields`, `sort`, `filter`, `search` | `apiFetch` → blob |
| 64 | GET | `/translations` | `system-input-translated-string` (store 012 hydrate) | | đã có |
| 65 | GET | `/assets/<id>?modified=<t>&key=system-medium-cover\|contain` hoặc `&width=250&height=150` | cards, kanban (ảnh), avatar user | | thẻ `img` |
| 66 | GET | tile/style nền bản đồ, glyph, Mapbox (khi có key, kể cả geocoder `api.mapbox.com/geocoding`) | layout map | | ngoài, FR-112 |
| 67 | GET (iframe) | `preview_url` đã điền | live preview | | ngoài, FR-112 |
| 68 | GET | `/server/info` | `queryLimit.max` (store server 012) | | đã có |

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 70 | POST | `<endpoint>` | tạo item, bản sao, singleton lần đầu? (không: singleton là PATCH) | `edits` đã khử field ẩn theo điều kiện; bản sao: item đầy đủ không khóa | |
| 71 | PATCH | `<endpoint>/<pk>` | lưu item, archive/unarchive, kéo sự kiện calendar, kéo thẻ kanban (`{[groupField]: id}`), sửa tiêu đề nhóm kanban (collection nhóm) | `edits` / `{[archive_field]: value}` | singleton: `PATCH <endpoint>` |
| 72 | PATCH | `<endpoint>` | archive hàng loạt, `DrawerBatch` | `{keys, data}` | |
| 73 | DELETE | `<endpoint>/<pk>` | xóa item, xóa nhóm kanban (collection nhóm) | | |
| 74 | DELETE | `<endpoint>` | xóa hàng loạt | mảng khóa | |
| 75 | POST | `/utils/sort/<collection>` | sắp xếp tay (tabular, kanban, nhóm kanban) | `{item, to}` | |
| 76 | POST | `/presets` | preset mới của user, bookmark mới | `Preset` không `id`, `user` = mình | |
| 77 | PATCH | `/presets/<id>` | lưu preset/bookmark của mình, đổi tên bookmark | `Partial<Preset>` | |
| 78 | DELETE | `/presets` | xóa bookmark | mảng id | |
| 79 | POST | `/versions` | tạo version (menu, hoặc `draft` khi lưu lần đầu) | `{key, name, collection, item}` | |
| 80 | PATCH | `/versions/<id>` | đổi tên/key | `{key, name}` | |
| 81 | DELETE | `/versions/<id>` | xóa version | | |
| 82 | POST | `/versions/<id>/save` | lưu version | `edits` | |
| 83 | POST | `/versions/<id>/promote` | promote | `{mainHash, fields}` | |
| 84 | POST | `/comments` | comment mới | `{collection, item, comment}` | |
| 85 | PATCH | `/comments/<id>` | sửa comment | `{comment}` | |
| 86 | DELETE | `/comments/<id>` | xóa comment | | |
| 87 | POST | `/shares` | share mới | `{name, role, password, date_start, date_end, max_uses, collection, item}` | |
| 88 | PATCH | `/shares/<id>` | sửa share | | |
| 89 | DELETE | `/shares/<id>` | xóa share | | |
| 90 | POST | `/shares/invite` | gửi mời | `{emails, share}` | API chỉ ghi log (D-36) |
| 91 | POST | `/utils/export/<collection>` | xuất vào thư viện | `{query: {...exportSettings, sort: [sort]}, format, file: {folder}}` | |
| 92 | POST | `/utils/import/<collection>[?background=true]` | nhập | multipart `file` | XHR để có tiến độ |
| 93 | POST | `/graphql` hoặc `/graphql/system` | `saveAsCopy` | `{query}` (`<c>_by_id`) | như Directus (011 có ở hai app) |
| 94 | SEARCH | `<endpoint>` | `findExistingRelatedItems` của `saveAsCopy` khi query dài | `{query}` | > 8192 ký tự |
| 95 | POST | `/flows/trigger/<id>` | Flows sidebar (013 #48) | `{collection, keys: selection \| [pk], ...fields}` | đã có |
| 96 | PATCH | `/users/me/track/page` | 012 #32 | | đã có |

Không có request ghi khác. `POST /files`, `/files/import` (013 #45, #47) dùng qua interface file trong form.
