# Contract: kiểm thử (R9, R12)

## 1. Vitest trong `apps/web` (như 013–017)

- `unit` (happy-dom): `stores/insights.test.ts` (hydrate có/không quyền; `loadPanelData` gộp tài liệu GraphQL so mốc
  `bo_dash_all` sau chuẩn hóa alias; tách hệ thống; lỗi từng phần; 400 → gọi lại bỏ panel lỗi; `setVariable` chỉ nạp
  lại panel liên quan; biến quan hệ rỗng; biến dùng chung giữa hai dashboard (R-55); 8 kịch bản staging/Save: thêm, sửa,
  kéo, đổi cỡ, nhân bản, xóa, Copy To, Save rỗng → body #193–#195 so mốc T002 luồng (2)–(4), (7)–(9); nhớ 3 dashboard), `panels/registry.test.ts` (so fixture trích: id, icon, name,
  description, minWidth/minHeight, variable, skipUndefinedKeys, options tĩnh, options hàm với bộ đối số mẫu, `query`
  với 3 bộ options mẫu mỗi loại), `utils/{get-groups,query-to-gql-string,point-on-line,format-number}.test.ts` (port
  test Directus nếu có; thêm ca mẫu), `panels/shared/{color-generator,conditional}.test.ts` (quirk R-53 giữ nguyên),
  `modules/{insights,activity}.test.ts` (route, guard, not-found, redirect `/content/directus_dashboards`),
  `ExtensionOptions.test.ts` (+ `type panel`), `BoFancySelect.test.ts` (+ grid), `stores/app.test.ts`
  (`notificationsDrawerOpen`).
- `browser` (chromium): `InsightsOverviewRoute` (bảng, sắp xếp, tìm, autofocus > 25, nút gated theo quyền, menu dòng,
  nhân bản body + lỗi R-49, xuất request, xóa, rỗng), `DashboardDialog` (tạo/sửa body, điều hướng), `BasicImportSidebarDetail`
  (thành công notice, lỗi dialog), `DashboardRoute` (xem `bo_dash_all`: 11 tile vị trí/cỡ, header, trạng thái nạp/lỗi/
  `no_data`, type lạ; zoom; refresh interval; sửa: nút, kéo, resize 8 tay cầm với kẹp min, bo góc, Duplicate, Copy To,
  Delete, Save body, Clear, guard, `meta+s`, focus FR-029), `PanelConfiguration` (11 loại, options của loại, nhóm header,
  Done mới/sửa, Cancel), 11 `Panel*.vue` (giá trị, định dạng số, định dạng có điều kiện, bảng sr-only của 5 biểu đồ với
  dữ liệu mẫu, `variable` đổi giá trị → `setVariable`, `relational-variable` drawer + display items, `list` DrawerItem),
  `BoWorkspaceTile` resize (unit-ish với pointer events), flows 017 không đổi (chạy lại `src/modules/settings/routes/flows`),
  `ActivityCollectionRoute` (preset mặc định, sub-menu → `filterSystem`, request #199, drawer #200, nút launch ẩn/hiện,
  lỗi notice), `NotificationsBell` (badge, 0 ẩn, `aria-label`), `NotificationsDrawer` (nạp khi mở, hai tab, chọn, archive/
  unarchive/xóa body, đếm lại, đích FR-072 ba dạng, markdown sạch, tìm, rỗng, phân trang), axe cho `/insights`, trang
  dashboard (hai chế độ), drawer panel (metric, time-series, variable), `/activity`, drawer activity, drawer thông báo
  (hai tab), chuông (sáng, tối), perf `modules/insights/perf.browser.test.ts` (`PERF=1`, `machineFactor()`).
- Coverage gộp ≥ 60 %.

## 2. API giả lập (`test-utils/fetch.ts`, `mockFixtureApi`)

- Thêm #185–#203; `ENDPOINTS` + `dashboards`, `panels`, `activity`, `notifications`; dữ liệu từ
  `fixtures/interfaces/snapshot/{dashboards,panels,notifications,activity}.json`; `Snapshot` (`test-utils/fixtures.ts`)
  thêm bốn khóa.
- `POST /graphql`, `/graphql/system`: mock trả `data` theo alias từ fixture `graphql.bo_dash_all.json` (response thật
  của Directus app ghi ở T002); ca lỗi từng phần và 400 theo yêu cầu test.
- `POST/PATCH/DELETE /panels`, `/dashboards`, `/notifications`: mock ghi vào `fetch.db` và trả `{data}`; test khẳng định
  body.
- `GET /activity`, `/notifications`: lọc theo `filter`, `search`, `page`, trả `meta`.
- Request ngoài danh sách → test thất bại (`KNOWN_REQUESTS`).

## 3. E2E `apps/web-e2e` (ba cấu hình, SC-001)

| Spec | Nội dung | Projects |
|------|----------|----------|
| `insights-overview.spec.ts` | US1 (chromium 768/1280 ba cấu hình): bảng 5 dashboard, sub-menu, tìm, tạo (hộp → điều hướng), sửa, nhân bản (số panel bản sao), xuất (request + file JSON tải), nhập lại file đã xuất (dashboard mới), xóa một và nhiều, trạng thái rỗng chỉ ở browser test | chromium 768/1280 ba cấu hình |
| `insights-dashboard.spec.ts` | US2: `bo_dash_all` 11 tile vị trí/cỡ/header, giá trị metric/metric-list/list/meter/label, bảng sr-only 5 biểu đồ so mốc, `bo_dash_system`, `bo_dash_empty`, `bo_dash_unknown`, zoom, auto refresh (chọn 10 s → request mới), Comments | chromium 768/1280 ba cấu hình |
| `insights-edit.spec.ts` | US3: dashboard tạm, "+" metric + bar chart, kéo (13,1), resize 8×4, Save (so body qua `recordWrites`), Duplicate, Copy To sang dashboard tạm 2, Delete, Clear, guard, `meta+s`, focus | chromium 768/1280 ba cấu hình + firefox/webkit 1280 cùng origin |
| `insights-variables.spec.ts` | US4: `bo_dash_vars` đổi `vars_status` 3 giá trị, chọn `vars_author` → metric/list đổi, request chỉ cho panel liên quan, bỏ chọn → không request | chromium 768/1280 ba cấu hình |
| `activity.spec.ts` | US5: tạo/sửa/xóa `bo_content` tạm, `/activity` cột và thứ tự, 4 mục sub-menu, lọc nâng cao `collection`, drawer (gồm user null và lỗi), launch, `/content/directus_activity` chuyển hướng, role tối thiểu chỉ thấy của mình | chromium 768/1280 ba cấu hình |
| `notifications.spec.ts` | US6, US7: user tạm `Fixtures` + 3 thông báo tạo ở `beforeAll`: badge 3, drawer hai tab, mở item ba dạng, archive → badge 2, unarchive, xóa có xác nhận, tìm, link Activity, lỗi archive (`page.route` 500) → hộp lỗi (R-57); notice tại chỗ khi nhập dashboard, hộp lỗi khi 500 giả | chromium 768/1280 ba cấu hình |
| `insights-cross-use.spec.ts` | FR-102 (a)–(d) trên Directus app 8155 | chromium-1280, `proxy-api` (`DIRECTUS_APP_SPECS`) |
| `insights-parity-ui.spec.ts` | SC-004 (a)–(f) | chromium-1280, `proxy-api` |
| `a11y.spec.ts` (+) | các màn FR-106 sáng/tối | chromium-1280 |

Dashboard/thông báo tạm của E2E đặt tên `web-e2e-<cfg>-<spec>-<n>` và xóa ở `afterAll`. Không E2E nào sửa `bo_dash_*`.
Webkit: test kéo/resize có thể `test.fixme` nếu flake, lý do ghi ở spec (SC-001).

## 4. Bộ so payload và bộ so DB (`proxy-api`)

- `payload/insights.spec.ts` (`test.skip(e2eConfig !== 'proxy-api')`): (1) tạo dashboard, (2) "+" metric + bar chart
  Save, (3) kéo + resize Save, (4) Duplicate + Delete Save, (5) Copy To Save, (6) sửa dashboard, (7) nhân bản dashboard,
  (8) xuất (request), (9) nhập, (10) xóa; mỗi kịch bản chạy trên Directus app 8155 rồi Backoffice, `recordWrites` +
  `normalizeInsightsBody`; đọc `POST /graphql` của `bo_dash_all` và `bo_dash_vars` (3 giá trị biến) so sau
  `normalizeGraphql`; mốc `payload/baselines/insights-*.json` ghi ở T002.
- `payload/activity.spec.ts`: `GET /activity` 4 mục + lọc `collection`, `GET /activity/:pk` so query sau chuẩn hóa
  (`canonicalPath`).
- `payload/notifications.spec.ts`: `GET /notifications` hai tab + tìm + trang 2, `PATCH`, `DELETE`, `GET` đếm.
- Bộ so DB: `changesSince`/`snapshot` với `INSIGHTS_TABLES` sau (1)–(7), (9), (10); `NOTIFICATIONS_TABLES` sau
  archive/unarchive/xóa; so sau chuẩn hóa (data-model §3, §10).
- Request song song (ba request `/panels`, `hydrate` sau ghi) sắp theo `(method, path, body)` trước khi so; query REST
  so theo nghĩa bằng `canonicalPath` (017).
- Activity: so trên `collection bo_insights_data` (chỉ seed ghi); dòng cùng `timestamp` so như tập.

## 5. Kịch bản dùng chéo (SC-002, SC-003, `insights-cross-use.spec.ts`)

1. `bo_dash_all` (seed qua Directus REST) mở ở Backoffice: `readGrid` = `readDirectusGrid` (0 ô lệch cả vị trí và cỡ),
   `readDirectusTileHeaders` = header Backoffice, text metric/metric-list/list/meter/label bằng nhau, ô `variable` hiện
   `defaultValue`, `relational-variable` rỗng; biểu đồ: bảng sr-only = cùng biến đổi của panel áp lên response GraphQL
   của Directus app (T002; thứ tự hạng mục, tên và số chuỗi, giá trị từng điểm); `INSIGHTS_TABLES` bằng mốc.
2. Dashboard tạm + metric + bar chart tạo và sắp ở Backoffice (13,1; 8×4) → `openDirectusDashboard` → lưới, header,
   giá trị bằng; sửa trên Directus app (thêm label, đổi cỡ metric 10×4, Save) → Backoffice tải lại → đúng.
3. Ngược lại: tạo dashboard + 2 panel trên Directus app → tải lại Backoffice → mở → so như (2).
4. Archive thông báo ở Backoffice → Directus app Archive có dòng, badge giảm; `archiveDirectusNotification` → Backoffice.
5. `bo_dash_vars`: đổi `vars_status` ở hai app → cùng giá trị metric và cùng tài liệu GraphQL.

## 6. Cổng CI

- `quality`: lint, typecheck, `web:test` (unit + browser, coverage ≥ 60 %), `check-port-headers`, `check-brand`,
  `check-bundle` (`BUDGET_018`, `LAZY_BUDGETS_018`), `pnpm audit` (apexcharts).
- `e2e-web`: ma trận ba cấu hình × projects; `insights-edit` vào danh sách core; `insights-cross-use`,
  `insights-parity-ui`, `payload/*` vào `DIRECTUS_APP_SPECS`; giới hạn 100 phút giữ (bảy spec mới ≈ +8 phút; cắt
  bớt ca ở `insights-dashboard` nếu vượt; thời gian thật ghi ở mỗi task đóng lượt, vượt thì tách shard như 016).
- Parity `web`: `fixtures-seed.test.ts` so snapshot `dashboards.json`, `panels.json`, `notifications.json` giữa hai
  app (bỏ `timestamp`, `directus_activity`).
