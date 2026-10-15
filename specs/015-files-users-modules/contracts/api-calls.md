# Contract: API mà module Files và Users gọi (FR-024, FR-039, FR-066, FR-077, FR-115, SC-003)

Bổ sung vào danh sách đóng của 012 (#1–#32), 013 (#33–#49), 014 (#50–#96). `apps/web-e2e/src/helpers/allowed-paths.ts`
và `KNOWN_REQUESTS` của `test-utils/fetch.ts` thêm các dòng dưới. Đã có từ 014 (dùng lại, không lặp): #50 danh sách,
#51 đếm, #52 item, #53 quyền item, #54–#56 presets/revisions, #59–#60 comments/users, #63 export tải về, #65 assets
ảnh, #68 server info, #70–#78 ghi item/preset, #84–#86 comments, #91–#92 utils export/import.

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 97 | GET | `/folders` | `useFolders` (cây, `FolderPicker`, `DeleteFolderDialog`) | `sort=name` (+ `limit=-1` ở picker); `filter[parent][_eq]`, `fields=id`, `limit=-1` ở xóa thư mục | `fetchAll` phân trang như Directus |
| 98 | GET | `/folders/<id>` | `FileInfoSidebarDetail` | `fields=id,name` | |
| 99 | GET | `/files` | `DeleteFolderDialog` (`filter[folder][_eq\|_in]`, `fields=id`, `limit=-1`); danh sách là #50 với `collection=directus_files` | | |
| 100 | GET | `/files/<id>` | `FileItemRoute` (#52), `ImageEditor` (`fields=type,filesize,filename_download,folder,width,height,focal_point_x,focal_point_y`), sau TUS | | |
| 101 | GET | `/assets/<id>` | `ImageEditor` (`?<nonce>`), `saveAsCopy` (blob), `download` (`?download=`), link "mở tab mới" | | `apiFetch` blob hoặc `<a>`/`<img>` |
| 102 | GET | `/users/<id>` | `FileInfoSidebarDetail` (chủ sở hữu, người sửa) | `fields=id,email,first_name,last_name,role` | #60 đã có `/users/<id>` cho so sánh; thêm query này |
| 103 | GET | `/roles` | `useNavigation` (users), `UsersInvite` | `fields=id,name,icon,parent` `sort=name`; `fields=id,name` `sort=name` | |
| 104 | GET | `/users` | danh bạ (#50 với `collection=directus_users`, `fields` gồm `avatar`...) | | |
| 105 | GET | `/utils/random/string` | `system-token` | | |
| 106 | GET | `/server/info` | store server: `uploads`, `project.default_theme_light\|dark` (#68) | | đã có; đọc thêm hai field |

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 110 | POST | `/folders` | `AddFolder` | `{name, parent}` | |
| 111 | PATCH | `/folders/<id>` | đổi tên, chuyển thư mục (menu cây) | `{name}` / `{parent}` | |
| 112 | PATCH | `/folders` | xóa thư mục chế độ move/delete | `{keys, data: {parent}}` | |
| 113 | DELETE | `/folders` | xóa thư mục | mảng id | |
| 114 | POST | `/files` | tải lên multipart (`BoUpload`, kéo thả, `saveAsCopy`, `ImageEditor` lưu mới) | FormData: preset (`folder`...) rồi `file` | 013 #45 đã có; thêm người gọi |
| 115 | PATCH | `/files/<id>` | lưu form (#71 dạng JSON), chuyển thư mục `{folder}` (+ `fields=folder.name`), thay file (FormData `file`), `ImageEditor` (FormData `focal_point_x/y` + `file`, hoặc JSON focal) | | multipart qua `apiFetch` |
| 116 | PATCH | `/files` | chuyển thư mục hàng loạt `{keys, data: {folder}}`; xóa thư mục move; `DrawerBatch` (#72) | | |
| 117 | DELETE | `/files` | xóa nhiều file, xóa thư mục delete, sau xóa thư mục kèm file đã chọn | mảng id | |
| 118 | DELETE | `/files/<id>` | màn file (#73) | | |
| 119 | POST | `/files/import` | `BoUpload` từ URL (013 #47) | `{url, data: {folder}}` | đã có |
| 120 | POST/PATCH/HEAD/DELETE | `/files/tus` và `/files/tus/<id>` | `tus-js-client` khi `uploads.tus` | giao thức TUS (`Upload-Metadata`, `Upload-Offset`, `Tus-Resumable`) | XHR của tus |
| 121 | POST | `/assets/files` | tải nhiều file | `{ids}` | zip, `Content-Disposition` |
| 122 | POST | `/assets/folder/<id>` | tải thư mục (menu cây) | — | zip |
| 123 | POST | `/users` | tạo user (#70) | `edits` (+ `role`) | |
| 124 | PATCH | `/users/<id>` | lưu form (#71), archive (`{status}`), `system-token` (`{token}` / `{token: null}`) | | |
| 125 | PATCH | `/users` | `DrawerBatch` (#72) | `{keys, data}` | |
| 126 | DELETE | `/users` / `/users/<id>` | xóa hàng loạt / màn user | | đăng xuất nếu có chính mình |
| 127 | POST | `/users/invite` | `UsersInvite` | `{email: string[], role}` | API ghi log (D-36) |
| 128 | POST | `/users/me/tfa/generate` | `system-mfa-setup` | `{password}` | 012 #?? đã có |
| 129 | POST | `/users/me/tfa/enable` | `system-mfa-setup` | `{otp, secret}` | 012 đã có |
| 130 | POST | `/users/me/tfa/disable` | `system-mfa-setup` (chính mình) | `{otp}` | mới |
| 131 | POST | `/users/<id>/tfa/disable` | `system-mfa-setup` (admin cho user khác) | — | mới |
| 132 | POST | `/utils/import/directus_files\|directus_users` | Export/Import sidebar (#92) | multipart | đã có |
| 133 | POST | `/utils/export/directus_files\|directus_users` | (#91) | | đã có |
| 134 | POST/PATCH/DELETE | `/presets` | preset `directus_files`, `directus_users` (#76–#78) | | đã có |

Không có request ghi khác. `/users/register` không có (Q2 = B). Request ra ngoài: không (nhập từ URL do API tải).
