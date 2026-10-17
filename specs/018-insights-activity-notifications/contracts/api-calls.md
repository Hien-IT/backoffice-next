# Contract: API mà Insights, Activity, Notifications gọi (FR-013..FR-015, FR-028, FR-041, FR-052, FR-063, FR-071, FR-110, SC-005)

Bổ sung vào danh sách đóng của 012 (#1–#32), 013 (#33–#49), 014 (#50–#96), 015 (#97–#136), 016 (#137–#177), 017
(#178–#184; #183–#184 chưa có trong code lúc plan, 018 không chạm). `apps/web-e2e/src/helpers/allowed-paths.ts` và
`KNOWN_REQUESTS` của `test-utils/fetch.ts` thêm các dòng dưới; `ENDPOINTS` của mock thêm `dashboards`, `panels`,
`activity`, `notifications`. Đã có (dùng lại, không lặp): #26 `GET /notifications` đếm (`aggregate[count]`), request
`/comments` của 014 (Comments sidebar), `GET /items/:collection` của 014 (`DrawerCollection`, `DrawerItem`),
`PATCH /items/:collection/:pk` của 014 (`DrawerItem` trong panel `list`), `/server/info`.

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 185 | GET | `/dashboards` | store `hydrate` (`fetchAll`) | `fields[]=*&sort[]=name&limit=-1` (`fetchAll` phân trang bằng `page` khi cần; mốc T002) | khi đăng nhập có quyền; sau mỗi ghi |
| 186 | GET | `/panels` | store `hydrate` (`fetchAll`) | `fields[]=*&sort[]=dashboard&limit=-1` | cùng lúc #185 |
| 191 | GET | `/dashboards` | `InsightsOverviewRoute` Export | `export=json&fields[]=<15 trường data-model §3>&filter={"id":{"_in":[…]}}` | tải bằng `apiFetch` + blob (R2) |
| 196 | POST | `/graphql` | store `loadPanelData` | body `{query: "query { query_<hash>: … }"}` | một tài liệu cho mọi panel collection người dùng của dashboard khi mở; sau Save: mọi panel chưa có dữ liệu ở mọi dashboard đã nạp (như Directus, mốc T002) |
| 197 | POST | `/graphql/system` | store `loadPanelData` | như #196 với collection hệ thống (bỏ tiền tố `directus_`) | chỉ khi có panel hệ thống |
| 198 | GET | `/items/:collection` (`/users`, `/files`… cho collection hệ thống, `getEndpoint`) | `use-display-items` (relational-variable) | `fields[]=<template>,<pk>&filter={"<pk>":{"_in":[…]}}` | khi biến có giá trị |
| 199 | GET | `/activity` | layout tabular của `ActivityCollectionRoute` | `fields[]=…&sort[]=-timestamp&limit&page&filter=<_and[hệ thống, người dùng]>&search&meta=filter_count,total_count` | dạng do `use-items` 014 gửi |
| 200 | GET | `/activity/:pk` | `ActivityItemRoute` | `fields[]=user.id,user.email,user.first_name,user.last_name,action,timestamp,ip,user_agent,origin,collection,item` | |
| 201 | GET | `/notifications` | `NotificationsDrawer` | `filter={"_and":[{"recipient":{"_eq":"<me>"}},{"status":{"_eq":"inbox\|archived"}}]}&fields[]=id,subject,message,collection,item,timestamp&sort[]=-timestamp&limit=25&page=<n>&search=<q>`; khi mở thêm `aggregate[countDistinct]=id` | chỉ khi drawer mở; `<me>` theo Directus (T001) |

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 187 | POST | `/dashboards` | `DashboardDialog` (tạo); `InsightsOverviewRoute` Duplicate | `{name, icon, color, note}`; nhân bản `{…dashboard, name: "<name> (copy)", panels: […]}`; query `fields=id` | sau đó #185 + #186 |
| 188 | PATCH | `/dashboards/<id>` | `DashboardDialog` (sửa) | `{name, icon, color, note}`; `fields=id` | sau đó #185 + #186 |
| 189 | DELETE | `/dashboards/<id>` | menu dòng | | sau đó #185 + #186 |
| 190 | DELETE | `/dashboards` | header (chọn nhiều) | `[id, …]` | sau đó #185 + #186 |
| 192 | POST | `/utils/import/directus_dashboards` | `BasicImportSidebarDetail` | multipart `file` (`text/csv` hoặc `application/json`) | thành công → notice + #185 + #186; lỗi → `ImportErrorDialog` |
| 193 | POST | `/panels` | store `saveChanges` | `[{dashboard, name, icon, color, note, type, position_x, position_y, width, height, options}, …]` (bỏ id tạm; panel mới không có `show_header`; Copy To và Duplicate gửi thêm `date_created`, `user_created`, `show_header` của panel gốc, như Directus, mốc T002) | song song với #194, #195 khi có |
| 194 | PATCH | `/panels` | store `saveChanges` | `[{id, …chỉ trường đổi}, …]` khi kéo/resize; sửa từ drawer panel gửi cả panel (gồm `dashboard`, `date_created`, `user_created`, `options`), như Directus (mốc T002) | |
| 195 | DELETE | `/panels` | store `saveChanges` | `[id, …]` | |
| 202 | PATCH | `/notifications` | `NotificationsDrawer` Archive/Unarchive | `{keys: [id, …], data: {status: "archived" \| "inbox"}}` | sau đó #201 + #26 |
| 203 | DELETE | `/notifications` | `NotificationsDrawer` Delete | `{keys: [id, …]}` (như Directus `notifications-drawer.vue:197-200`) | sau đó #201 + #26 |

Không có request nào khác trong E2E (SC-009). Fixture seed (`seed.mjs`) gọi thêm `POST /dashboards`, `POST /panels`
mảng, `POST /notifications` (admin), `DELETE /dashboards`, `DELETE /notifications` mảng; không thuộc allowlist của app.

**Mốc Directus (T002, 2026-10-18)**: `apps/web-e2e/src/payload/baselines/insights-*.json`. Một khác biệt về đọc còn lại,
không ảnh hưởng dữ liệu: khi mở dashboard có relational variable, Directus gửi thêm `GET /users` (danh sách) và một đếm
`countDistinct` của drawer chọn item dù drawer đang đóng (`drawer-collection` luôn được dựng); app không gửi vì
`DrawerCollection` chỉ dựng khi mở. Chờ chủ dự án xác nhận.

