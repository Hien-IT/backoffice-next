# Contract: Web (`apps/web`)

Mọi màn hình không nêu giữ nguyên.

## 1. Ma trận quyền của policy (`system-permissions`, FR-022..FR-027)

| Phần | Hành vi |
|------|---------|
| Cột | create, read, update, delete, import, export (API là Backoffice); create, read, update, delete (API là Directus, FR-034). Không cột share. |
| Nguồn | 5 action: o2m `permissions` của policy (như nay). import, export: `GET /backoffice/permissions?filter[policy][_eq]=<id>&limit=-1`, staging riêng, ghi sau khi policy lưu (`POST`, `PATCH` batch, `DELETE`). |
| Ô import/export | bấm: menu All access / No access / Use custom như action khác; trạng thái none / full / partial (có bộ lọc, field hay định dạng). Ô import của collection hệ thống bị khóa (chỉ admin import được, như Directus; analyze I1). |
| Ô khi toggle 024 tắt | `opacity-50`, `title` = "Đã tắt trong Data Model" (overlay `bo_toggle_off_hint`), vẫn sửa, lưu được (FR-025). |
| All access / No access của hàng | 6 action; không đụng dòng `share` cũ (FR-023, FR-024). |
| Hàng `directus_shares` | vẫn hiện (FR-023). |
| Save | nút bật khi có sửa ở nguồn nào; `useEditsGuard` theo cả hai; lưu policy trước, dòng mới sau; lỗi nguồn hai → dialog lỗi, staging giữ. |
| Nhân bản policy | chép cả dòng `backoffice_permissions` (FR-027). |
| Xóa policy | API xóa theo (FR-021). |

Drawer Use custom của import, export (`PermissionsDetail.vue`): tiêu đề `<policy> -> <collection> -> Import|Export`;
tab "Item Permissions" (bộ lọc dòng, `PermissionsTab`), "Field Permissions" (`FieldsTab`), "Formats" (mới,
`FormatsTab`: nhóm checkbox các định dạng của action, không chọn = tất cả). Không tab Validation, Presets. Phím: như
drawer hiện có (Reka UI Tabs, focus-visible, Esc đóng).

## 2. Import, export ở các module (FR-028, FR-034)

`useCollectionPermissions(collection)` thêm `importAllowed`, `exportAllowed`, `exportFormats`:

| API trả `/permissions/me` | `exportAllowed` | `importAllowed` | `exportFormats` |
|---------------------------|-----------------|-----------------|-----------------|
| có khóa `import`/`export` (Backoffice) | `export.access !== 'none'` (admin: true) | `import.access !== 'none'`; collection hệ thống: chỉ admin | `export.formats` hoặc tất cả |
| không có (Directus, cache Directus) | `readAllowed` | `createAllowed && updateAllowed`; collection hệ thống: chỉ admin | tất cả |

| Chỗ | Hành vi |
|-----|---------|
| `ExportSidebarDetail` (Content, Users, Files, Presets, Translations) | phần export (gồm "Download Page as CSV") khi `exportAllowed && showExport`; phần import khi `importAllowed && showImport`; select định dạng chỉ `exportFormats`, mặc định định dạng đầu. |
| `BasicImportSidebarDetail` | hiện khi `importAllowed`. |
| Insights (`InsightsOverviewRoute`) | nút "Export dashboard" theo `exportAllowed('directus_dashboards')`; import theo `importAllowed`. |

"Download Page as CSV": tạo file ở trình duyệt từ các dòng đang hiển thị; không áp bộ lọc, field, định dạng của Use
custom (clarify câu 5).

## 3. Bỏ share (FR-029, D-189.4)

| Chỗ | Sau 025 |
|-----|---------|
| Sidebar trang item (`ItemRoute`) | không mục Shares (Revisions, Comments, Flows giữ). |
| Route `/shared/:id` (`SharedRoute.vue`) | bỏ; URL rơi vào trang not found (chưa đăng nhập → trang đăng nhập như mọi route riêng tư). |
| Drawer quyền | không mở được action share (không còn cột). |
| `router/guard.ts`, store user `share` | giữ (phiên share qua API). |

## 4. Chuỗi (en-US, vi-VN, overlay)

| Khóa | en-US | vi-VN | Dùng ở |
|------|-------|-------|--------|
| `import`, `export` | có sẵn | có sẵn | cột, tiêu đề drawer |
| `bo_formats` | Formats | Định dạng | tab drawer |
| `bo_formats_hint` | No format selected means every format | Không chọn định dạng nào nghĩa là mọi định dạng | tab drawer |
| `bo_toggle_off_hint` | Turned off in Data Model for this collection | Đã tắt trong Data Model của collection này | ô mờ |

## 5. Design system (XII)

Không màu, token, component mới: cột và ô dùng `PermissionsToggle` hiện có; tab mới dùng `BoTabs`, checkbox của
`design-system` (`BoCheckbox`); ô mờ bằng `opacity-50` (Tailwind) và `title`; không hex, không palette ngoài theme.
