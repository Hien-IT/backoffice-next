# Contract: API mà trình chỉnh sửa Flows gọi (FR-016, FR-032, FR-045, FR-054, FR-110, SC-005)

Bổ sung vào danh sách đóng của 012 (#1–#32), 013 (#33–#49), 014 (#50–#96), 015 (#97–#136), 016 (#137–#177).
`apps/web-e2e/src/helpers/allowed-paths.ts` và `KNOWN_REQUESTS` của `test-utils/fetch.ts` thêm các dòng dưới. Đã có
(dùng lại, không lặp): #33 `GET /flows` (store `hydrate`, nay gọi thêm sau mỗi ghi của 017), #48 `POST /flows/trigger/:id`
(014, nút chạy thủ công; E2E 017 chỉ ghi thêm người gọi), #68 `/server/info`, request `GET /revisions` danh sách và đếm của 014 (Revisions sidebar; query
khác ở #183–#184).

## Đọc

| # | Method | Path | Ai gọi | Query | Ghi chú |
|---|--------|------|--------|-------|---------|
| 183 | GET | `/revisions` | `LogsSidebarDetail` (`useRevisions` danh sách) | `filter[_and][0][collection][_eq]=directus_flows` `[1][item][_eq]=<id>` `[2][version][_null]=true` `[3][activity][action][_eq]=run` `sort=-id` `limit=10` `page=<n>` `fields[]=id,collection,item,activity.action,activity.timestamp,activity.user.id,activity.user.email,activity.user.first_name,activity.user.last_name,activity.ip,activity.user_agent,activity.origin,data,delta` | `limit = min(10, queryLimit.max)`; dạng query đúng của SDK (`fields[]`) |
| 184 | GET | `/revisions` | `LogsSidebarDetail`: (a) đếm khi mount; (b) request "created" của `use-revisions`, gửi cùng lần nạp danh sách #183 (`use-revisions.ts:124`) | (a) `aggregate[count]=id` + cùng filter; (b) filter `activity.action _eq create` `limit 1` | "created" giữ như Directus (không dùng); mở mục Logs = #183 + #184 (b) |

## Ghi

| # | Method | Path | Ai gọi | Body | Ghi chú |
|---|--------|------|--------|------|---------|
| 178 | POST | `/flows` | `FlowDrawer` (tạo) | `{name, icon, color, description, status, accountability, trigger, options}`; query `fields=id` | sau đó #33 |
| 179 | PATCH | `/flows/<id>` | `FlowDrawer` (sửa, cả body như #178); `FlowsOverviewRoute` menu (`{status}`); `FlowRoute` Save (`{...stagedFlow, operations: {create, update, delete}, operation}`); pencil Trigger (cả body) | | sau đó #33 |
| 180 | DELETE | `/flows/<id>` | `FlowsOverviewRoute`, `FlowRoute` | | sau đó #33; trang flow về danh sách kể cả khi lỗi |
| 181 | PATCH | `/operations` | `FlowRoute` Save (trước #179) | `[{id, resolve: null} \| {id, reject: null}]` | chỉ khi có link cũ sẽ nối lại |
| 182 | POST | `/operations` | `CopyToDialog` | panel bỏ `id`, `date_created`, `user_created`, `resolve`, `reject`; `flow = <đích>` | ngay, không staging; sau đó #33 |

Không có request nào khác trong E2E (SC-009). Fixture seed (`seed.mjs`) gọi thêm `POST /flows` với `operations` lồng
dạng cây, `POST /flows/trigger/<id>` và `DELETE /flows` mảng; không thuộc allowlist của app.
