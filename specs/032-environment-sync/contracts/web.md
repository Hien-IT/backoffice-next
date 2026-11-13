# Contract: Web (Settings > trang đồng bộ, D-214.1)

Thành phần theo `design-system/docs/component-specs.md` (Button, Input, Checkbox, Table, Modal, Notice, Tabs). Bố cục
dưới đây là **câu trả lời cho Q-49**, design owner duyệt 2026-11-14 (FR-033): `layout-patterns.md` không có mẫu trang
nhiều bước hay bảng so sánh (research R12). Recipe Q-49 được ghi vào `component-specs.md` ngay trước
`## Acceptance criteria` ở lượt web.

## Route, menu, probe

- Route `settings-sync`, path `/settings/sync`, khai trong `apps/web/src/modules/settings.ts` trước `settings-not-found`.
- `composables/use-environment-sync.ts`: probe `GET /backoffice/sync` một lần cho mỗi URL API (mẫu
  `use-extension-upload.ts`); 200 → `available = true`; mọi trả lời khác (404 ở Directus) → `false`.
- `SettingsNavigation.vue`: thêm link `{ icon: 'sync_alt', name: t('settings_sync'), to: '/settings/sync' }` chỉ khi
  `available`. Vị trí đề xuất: cuối nhóm 1, sau Flows (design owner duyệt 2026-11-14).
- `available === false`: route hiện trang not-found của Settings như một đường dẫn lạ.

## Trạng thái của trang

Một composable `use-sync.ts` giữ mọi thứ trong `ref` của trang: `url`, `token`, `groups`, `rows`, `hash`, `selected`
(Set của `SyncRow.id`), `phase`. Không Pinia, không `localStorage`, không `sessionStorage`. `onBeforeUnmount` xóa `url`
và `token`. Tải lại trang là form trống (FR-003).

| `phase` | Hiện | Chuyển sang |
|---|---|---|
| `idle` | form kết nối | `comparing` khi bấm So sánh |
| `comparing` | form khóa, `aria-busy`, vòng tiến trình | `compared` hoặc `idle` kèm lỗi |
| `compared` | form (sửa được), bảng so sánh, nút Áp dụng | `applying` sau hộp xác nhận; `comparing` khi so sánh lại |
| `applying` | bảng khóa, `aria-busy` | `done` hoặc `compared` kèm lỗi |
| `done` | kết quả, nút "So sánh lại" | `comparing` |

## Form kết nối

| Ô | Thành phần | Ghi chú |
|---|---|---|
| URL nguồn | `BoInput type="url"`, nhãn `$t('sync_source_url')`, bắt buộc | kiểm phía trình duyệt: bắt đầu bằng `http://` hoặc `https://` |
| Token | `BoInput type="password"`, `autocomplete="off"`, nhãn `$t('sync_source_token')`, bắt buộc | không bao giờ hiện lại; trình duyệt vẫn có thể đề nghị lưu (R12) |
| Nhóm | danh sách `BoCheckbox`, mặc định tick cả mười | FR-008 |
| So sánh | `BoButton` primary | disabled khi thiếu ô hoặc đang chạy |

Lỗi của API hiện bằng `BoNotice type="danger"` dưới form, lấy `errors[0].extensions.reason`, dịch theo bảng chuỗi; lỗi
lệch phiên bản hiện thêm hai phiên bản.

## Bảng so sánh và chọn

- Thanh lọc trạng thái: `BoTabs` với "Tất cả", "Khác nhau", "Chỉ ở nguồn", "Chỉ ở đích", mỗi tab kèm số dòng. Mặc định
  "Khác nhau + chỉ ở một bên" (ẩn dòng `same`).
- Mỗi nhóm là một `BoDetail` (thu gọn được), tiêu đề: tên nhóm và số dòng theo trạng thái. Trong đó là `BoTable` với
  `showSelect: 'none'` và các cột: ô tick (tự vẽ qua slot `item.select`), nhãn, loại, trạng thái (chip có chữ, không
  chỉ màu), lý do không tick được.
- Ô tick ở header của nhóm (slot `header.select`): `BoCheckbox` với `indeterminate` khi chỉ một phần dòng tạo/sửa được
  tick; tick nó chọn mọi dòng `changed` và `source_only` có `selectable`; không bao giờ chọn dòng `target_only`
  (FR-016, FR-018).
- Dòng `selectable: false`: ô tick disabled, cột lý do hiện `$t(reason)`.
- Tick một dòng tự tick các dòng trong `depends` chưa `same`; bỏ tick một dòng bỏ tick các dòng phụ thuộc vào nó.
  Dòng phụ thuộc không tick được thì dòng này cũng bị chặn, kèm lý do nêu tên dòng thiếu.
- Tick xóa một dòng tự tick xóa các dòng trong `cascade`; các dòng đó hiện ô tick bị khóa kèm chú thích
  `$t('sync_deleted_with', { name })` cho tới khi bỏ tick dòng gốc (checklist 2026-11-14, CHK029).
- Bấm vào nhãn của dòng (nút) mở chi tiết.

## Chi tiết dòng (`SyncRowDetail.vue`)

`BoDialog` tiêu đề là nhãn dòng. Dòng `changed`: bảng ba cột "Field", "Nguồn", "Đích", mỗi `changes[]` một hàng; giá trị
object hiện JSON thụt lề trong `<pre>`. Dòng `source_only` hoặc `target_only`: một cột giá trị và ghi rõ bên kia không
có. Không dùng `ComparisonModal` (gắn với item và phiên bản).

## Áp dụng

- Nút `BoButton` primary "Áp dụng (n)" ở slot `#actions` của `PrivateView`; disabled khi `n = 0`.
- Hộp xác nhận (`SyncConfirmDialog.vue`, `BoDialog`): số dòng tạo, sửa, xóa theo nhóm; danh sách tên collection, field và
  dòng sẽ bị xóa, gồm dòng xóa kèm dưới tên dòng gốc; với collection: số item sẽ mất; với role: số user sẽ bị đình chỉ và mất role; với policy: số
  permission xóa theo; với folder: số file về gốc; danh sách flow sẽ bật ngay; câu "thao tác xóa không hoàn tác được".
  Nút xác nhận là `variant="danger"` khi có dòng xóa, primary khi không. Hủy không gửi gì (FR-021).
- Gửi `POST /backoffice/sync/apply` với `url`, `token`, `hash`, `groups`, `selected`.
- Lỗi "comparison is out of date": `BoNotice` kèm nút "So sánh lại".
- Thành công: `phase = 'done'`, hiện `SyncResult.vue`: số đã tạo, sửa, xóa theo nhóm; tên thứ đã xóa; bảng index đang
  tạo hoặc lỗi; `BoNotice type="warning"` cho mỗi mục `warnings` (bước sau khi ghi bị lỗi); `notify` một dòng. Các store bị ảnh hưởng (collections, fields, relations, permissions, settings,
  flows) được tải lại như sau khi sửa tay.

## Bàn phím và a11y (FR-035)

Mọi ô, tab, nút, ô tick, nút mở chi tiết nằm trong thứ tự tab; bảng có `caption`; trạng thái dòng có chữ; lỗi form gắn
`aria-describedby`; hộp thoại trả focus về nút đã mở; vùng kết quả là `role="status"`. Browser test chạy axe trên bốn
`phase` chính.

## Chuỗi (overlay `en-US.ts`, `vi-VN.ts`, khối `// Spec 032 (D-214)`)

`settings_sync`, `sync_source_url`, `sync_source_token`, `sync_groups`, `sync_compare`, `sync_compare_again`,
`sync_apply`, `sync_apply_count`, `sync_state_same`, `sync_state_changed`, `sync_state_source_only`,
`sync_state_target_only`, `sync_group_<GroupKey>` (10), `sync_kind_<kind>`, `sync_confirm_title`, `sync_confirm_delete`,
`sync_confirm_irreversible`, `sync_confirm_flows_active`, `sync_impact_items`, `sync_impact_users`,
`sync_impact_permissions`, `sync_impact_files`, `sync_result_title`, `sync_result_indexes`, `sync_field`, `sync_source`,
`sync_target`, `sync_missing_other_side`, các lý do `sync_duplicate_key`, `sync_extension_missing`, `sync_file_missing`,
`sync_value_hidden`, `sync_admin_protected`, `sync_needs_row`, `sync_deleted_with`, `sync_post_commit_warning`, và một chuỗi cho mỗi `reason` của API. Tên trang đề xuất:
"Environment Sync" / "Đồng bộ môi trường" (design owner duyệt 2026-11-14).

## File

```text
apps/web/src/
├── composables/use-environment-sync.ts (+ .test.ts)          # probe
├── modules/settings.ts                                        # route settings-sync
├── modules/settings/components/SettingsNavigation.vue (+ .test.ts)   # link có điều kiện
├── modules/settings/routes/sync/
│   ├── SyncRoute.vue (+ .test.ts, .browser.test.ts)          # PrivateView, các phase
│   ├── use-sync.ts (+ .test.ts)                               # trạng thái, tick kèm, gọi API
│   └── components/SyncConnectForm.vue, SyncGroup.vue, SyncRowDetail.vue, SyncConfirmDialog.vue, SyncResult.vue
├── lang/overlay/en-US.ts, vi-VN.ts
└── test-utils/fetch.ts                                        # KNOWN_REQUESTS cho bốn route
```
