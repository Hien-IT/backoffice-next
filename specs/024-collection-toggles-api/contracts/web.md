# Contract: Web (`apps/web`)

Không component, chuỗi, màu hay bố cục mới; chỉ ẩn ô nhập từ khóa có sẵn (Nguyên tắc XII, không câu hỏi mở).

## DrawerCollection (`components/drawers/DrawerCollection.vue`, FR-014, D-188.3)

| Trạng thái `bo_show_search` của collection đích | Ô nhập từ khóa (`SearchInput`) | Nút bộ lọc | `search` gửi lên layout/API |
|--------------------------------------------------|--------------------------------|------------|------------------------------|
| `true` / `null`                                  | hiện (như nay)                 | hiện       | từ preset (như nay)          |
| `false`                                          | ẩn (`:show-search="false"`, 022) | hiện, badge số bộ lọc | `null` (không gửi, preset giữ nguyên) |

- Prop `showSearch` của `SearchInput` (022): ẩn nút search, input và nút xóa; pill vẫn có nút Filter; `activate` không mở.
- Drawer của extension (`directus-shim/components/DrawerCollection.vue`) bọc component này nên theo cùng.
- Bàn phím: Tab tới nút Filter, Enter mở popover (như Content, SC-004 của 022).

## `list-o2m` (`interfaces/list-o2m/ListO2M.vue`)

| Điều kiện                                                                                 | Ô search của interface |
|-------------------------------------------------------------------------------------------|------------------------|
| `enableSearchFilter` tắt                                                                  | ẩn (như nay)           |
| `enableSearchFilter` bật, collection liên quan (`relationInfo.relatedCollection`) `bo_show_search` ≠ `false`, `totalItemCount > 10` hoặc đang có từ khóa/bộ lọc | hiện (như nay) |
| `enableSearchFilter` bật, collection liên quan `bo_show_search === false`                 | ẩn; `query.search` không gửi |

Bộ lọc (`searchFilter`) của interface không đổi. Tùy chọn `enableSearchFilter` của field không đổi.

## `list-m2m` (`interfaces/list-m2m/ListM2M.vue`)

Như `list-o2m`, xét `relationInfo.junctionCollection.meta.bo_show_search` (collection trung gian nhận từ khóa qua
`use-relation-multiple`).

## Nguồn dữ liệu

`meta.bo_show_*` đến từ `GET /collections` (store collections, 022): đổi cài đặt có tác dụng ở lần tải collections tiếp
theo, như Content.
