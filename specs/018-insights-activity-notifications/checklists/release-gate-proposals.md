# Lời giải đề xuất cho release-gate 018

Owner yêu cầu áp toàn bộ (2026-10-17); đã áp vào spec, plan, research, data-model, contracts, tasks. Hành vi Directus kiểm bằng
đọc mã nguồn 2026-10-17 (báo cáo agent và kiểm trực tiếp): `stores/insights.ts:421-461`, `modules/insights/routes/
{dashboard,overview,panel-configuration}.vue`, `components/dashboard-dialog.vue`, `views/private/components/
notifications-drawer.vue`, `panels/*`, `components/v-workspace*.vue`, `idle.ts`, `utils/md.ts`, `modules/activity/
routes/item.vue`, `directus/api/src/{middleware/respond.ts,services/comments.ts}`. Mã nguồn đã đọc, chưa chạy thử trừ
khi ghi.

Ký hiệu cột "Loại": **G** = ghi hành vi Directus vào spec (không đổi hướng); **R** = hành vi Directus có rủi ro, giữ
nguyên và ghi R-xx; **K** = app khác Directus (ghi D-xx hoặc "Cần xác nhận"); **T** = sửa test/bộ mẫu/task.

| Mục | Loại | Lời giải đề xuất | Sửa ở |
|-----|------|------------------|-------|
| CHK001 | R | Như `insights.ts:421-461` + `dashboard.vue:168-171`: một request lỗi → `Promise.all` reject, không `hydrate`, không `clearEdits`, hộp lỗi; trang VẪN thoát chế độ sửa (`editMode = false` luôn chạy) còn staging giữ (`hasEdits` true, guard rời trang còn chặn); request đã thành công không hoàn lại; Save lại gửi lại toàn bộ staging → panel tạo lần đầu có thể bị tạo trùng. Spec US3-5 hiện ghi sai ("staging và chế độ sửa giữ"): sửa theo Directus và thêm **R-56** (tạo trùng khi Save lại sau lỗi một phần; tái tạo). | Spec US3-5, FR-028, Edge Cases, bảng R; tasks T061 |
| CHK002 | G | Hộp dashboard: lỗi → hộp lỗi, hộp còn mở (`dashboard-dialog.vue:62-77`, `persistent`); xóa một: lỗi → hộp lỗi, hộp xác nhận còn (`overview.vue:176-184`); xóa hàng loạt: lỗi → hộp lỗi, hộp xác nhận đóng, lựa chọn giữ (`:197-209`) | Spec FR-011, FR-012; tasks T030, T031 |
| CHK003 | K | Directus: Archive/Unarchive không bắt lỗi (`notifications-drawer.vue:180-194`, lỗi chỉ ở console, lựa chọn giữ); Delete `try/finally` (lựa chọn bỏ, hộp đóng, lỗi ở console); lỗi nạp danh sách không hiện (`useItems.error` không đọc). Đề xuất: app thêm `catch` → hộp lỗi (`showUnexpectedError`) cho cả ba, giữ phần còn lại như Directus; ghi **R-57** (như R-49: Directus không bắt lỗi, app hiện hộp lỗi, thành công không đổi) | Spec FR-071, bảng R; tasks T091, T095 |
| CHK004 | G | `use-display-items.ts:49-66`: lỗi → hộp lỗi; khóa không còn: không hiện (lọc `_in`), nút bỏ chọn chỉ phát khóa tìm thấy nên khóa cũ bị bỏ khi người dùng bỏ chọn; vượt `limit` → báo lỗi và giữ `limit` khóa đầu (lựa chọn mới đứng trước); `limit` không đặt → không giới hạn, nút "thêm" ẩn khi đủ 5 (mặc định) | Spec FR-052, Edge Cases; tasks T047, T070 |
| CHK005 | G + K nhỏ | `panelKey` không có: drawer mở với `{}`, lưới loại, Done khóa tới khi chọn loại (`panel-configuration.vue:54,148`); Directus khi đó gọi `stagePanelUpdate` cho id không tồn tại (có thể ném lỗi khi tính lại truy vấn). Đề xuất: giữ luồng, nhưng `stagePanelUpdate` của app bỏ qua id không có trong store (không ném) — ghi "Cần xác nhận". Type lạ: drawer mở, lưới không chọn mục, options rỗng | Spec Edge Cases, "Cần xác nhận"; tasks T014, T062 |
| CHK006 | G | Không có guard: nút sửa chỉ `disabled` theo `useItemPermissions('directus_panels', <id dashboard>)` (`dashboard.vue:51,255`, truyền id dashboard làm id panel); route `panel-detail` không guard; `meta+s` gọi Save cả ngoài chế độ sửa (`:164-166`). Người không quyền vào URL drawer được, Done vào staging, Save → API 403 → hộp lỗi. App giữ y như vậy (quyền thật ở API); ghi "Cần xác nhận" | Spec US3-1, FR-001, "Cần xác nhận"; tasks T061 |
| CHK007 | G | Port nguyên: bar bỏ nhóm falsy (`!rawX`, kể cả 0 và chuỗi rỗng), `Number(null)` → 0 (`panel-bar-chart.vue:145-152`); line truyền giá trị thô, nhóm null thành một hạng mục; pie `Number(value*100)` chỉ khi có `decimals`; time-series `Number(null)` → 0. GraphQL trả số theo kiểu schema (`count` Int, `sum`/`avg` Float) nên chuỗi số không xuất hiện qua đường này [Unverified với decimal lớn]; ghi R-53 mở rộng "xử lý null theo từng panel như Directus" | Spec Edge Cases, R-53; tasks T041, T046 |
| CHK008 | G | Số: `n()`/`Intl.NumberFormat` theo `locale` vue-i18n = ngôn ngữ người dùng (`format-number.ts:133-150`, `set-language.ts:28`); ngày trục: trình duyệt, `datetimeUTC: false`, tooltip `d(…, 'long')`. SC-002 so với cùng user (admin, cùng ngôn ngữ) ở hai app nên chuỗi bằng nhau | Spec FR-042, FR-050, SC-002 |
| CHK009 | G | Múi giờ trình duyệt, không dùng setting của user; chỉ field `timestamp` trừ offset hiện tại của trình duyệt (`panel-time-series.vue:169,360`); API Postgres nhóm `timestamp` theo UTC. E2E hai app cùng trình duyệt nên cùng kết quả; bộ mẫu dùng field `dateTime` (không offset) | Spec FR-050, Edge Cases; data-model §12 |
| CHK010 | G | `v-md` → `md()`: `marked` + DOMPurify `ADD_ATTR: ['target']`, link mặc định `target="_self"`, `_blank` thêm `rel="noopener noreferrer"` (`utils/md.ts:13-30`); `md()` của 013 (`utils/markdown.ts`) kiểm cùng cấu hình (T001) | Spec FR-074; tasks T001, T091 |
| CHK011 | G | `label.text` hiện chữ thuần (`{{ text }}`, `panel-label.vue:113`); `list` qua `RenderTemplate` (phần chữ escape; phần field qua display 013) | Spec FR-045, FR-046 |
| CHK012 | G | Mention trong bình luận dashboard: API tạo thông báo `collection directus_dashboards`, `item <id>` (`comments.ts:153-154`); nút mở của drawer dùng `getItemRoute` → `/insights/<id>` (đúng); link trong `message` do API ghi cứng `/admin/content/directus_dashboards/<id>` → app chuyển hướng qua `checkForSystem` (FR-003) | Spec FR-072, Edge Cases |
| CHK013 | G | Tên file từ `Content-Disposition`: `directus_dashboards <YYYYMMDD-HMS>.json` (`respond.ts:79-90`, giờ phút giây không đệm 0); `ExportSidebarDetail` của 014 đọc header, fallback `<collection>.json`; dashboard 0 panel xuất với `panels: []` | Spec FR-013 |
| CHK014 | G + K nhỏ | `user` null: hàng User rỗng (`item.vue:111-116`); lỗi: `BoNotice danger` — Directus in nguyên object lỗi (`{{ error }}`), app in thông điệp dịch (`translateAPIError` như 014) → "Cần xác nhận" | Spec FR-063, "Cần xác nhận"; tasks T080 |
| CHK015 | G | Phiên share không vào khung private (route `/shared/:id` công khai) nên không có chuông; store notifications bỏ qua user share (`stores/notifications.ts` web:15-17, như Directus :23) | Spec FR-070 |
| CHK016 | G | Mọi user vào được app đều có quyền tối thiểu đọc activity của mình (`app-access-permissions.yaml:4-8`); user không có app access không đăng nhập được app (012) nên không có ca này | Spec US5-5 |
| CHK017 | G | Panel không truy vấn (label, list `displayTemplate`, variable) nhận options sau `applyOptionsData` trong computed của trang → hiển thị đổi ngay, không request; `setVariable` chỉ quyết định panel nào nạp lại dữ liệu | Spec FR-054 |
| CHK018 | G | `zoomScale = min((w − 2·pad)/W, (h − header − 2·pad)/H)`, Directus pad 0.6875rem (1.375rem từ 36rem), header 3.375rem (`_variables.scss`), không kẹp; app dùng padding và chiều cao page header của 012 (đo lúc chạy); ở 768 panel chi tiết là drawer nên chiều rộng là cả vùng nội dung | Spec FR-022; recipe Q-34 |
| CHK019 | G | Góc "chạm" = điểm góc nằm trên cạnh của tile khác (`pointOnLine`: tích chéo 0 và trong đoạn); bán kính lấy từ recipe Q-34 (`rounded-*` của Tailwind), góc chạm = 0 | Spec FR-023; recipe Q-34 |
| CHK020 | G | Nhàn rỗi = 5 phút không có `pointermove`/`pointerdown`/`keydown` (throttle 500 ms) hoặc tab ẩn (`visibilitychange`) (`idle.ts:4-13,42-52`, web đã port); khi hoạt động lại: nạp ngay rồi chạy lại chu kỳ | Spec US2-5 |
| CHK021 | G | Directus `.panel-container.loading { opacity: 0.5 }` với chuyển tiếp ngắn, không chặn tương tác (`dashboard.vue:404-408`); app `opacity-50`, `motion-reduce` bỏ chuyển tiếp | Spec FR-021; recipe Q-34 |
| CHK022 | G | `collectionsStore.getCollection(collection)?.meta?.singleton` (`notifications-drawer.vue:110-112`) | Spec FR-072 |
| CHK023 | T | Bảng sr-only chứa giá trị số sau biến đổi của panel (trước khi định dạng): bar `Number(toFixed)`, pie giá trị gốc (không ×100), line/time-series giá trị chuỗi; mốc so = cùng biến đổi áp lên response GraphQL của Directus app (T002), so số với sai số 0 sau làm tròn `decimals` | Spec FR-105, SC-002; contracts/tests §5; tasks T041, T049 |
| CHK024 | G | Tile `role="region"`, `aria-label` = `name` hoặc tên loại khi tắt header/không tên; `<caption>` của bảng sr-only = cùng nhãn | Spec FR-106 |
| CHK025 | G | Đúng nguồn: Export header khóa khi không `create` (`overview.vue:229-236`), Export ở menu dòng không gated; ghi "Cần xác nhận" (giữ như Directus) | Spec "Cần xác nhận" |
| CHK026 | G | So theo nghĩa bằng `canonicalPath` của `e2e/helpers/payload.ts` (017) cho mọi request đọc; thêm câu này vào FR-101 | Spec FR-101 |
| CHK027 | G | Directus drawer thông báo: 10 `VSkeletonLoader` khi `loading` (`notifications-drawer.vue:339-340`); app 10 dòng skeleton (`BoSkeleton`/dòng xám) thay "`BoTable loading`" | Spec FR-005, FR-071; recipe Q-39 |
| CHK028 | G | Không mâu thuẫn: `--theme--primary` → `--color-brand-500` là ánh xạ có sẵn ở 012 (constitution XII ví dụ `primary` → `--color-brand-500`, override map); D-108 chỉ thay biến không tồn tại bằng biến tương ứng; Q-35 chỉ chốt bảng màu chuỗi sinh ra và màu trục/lưới. Ghi lý do này vào D-108 | Spec D-108 |
| CHK029 | T | SC-002 với hai panel biến của `bo_dash_all`: so giá trị hiện của ô `variable` (= `defaultValue`) và trạng thái rỗng của `relational-variable` (không item) | Spec SC-002 |
| CHK030 | G | Đưa số vào FR-109: route Insights ≤ 60 KB, panel components ≤ 40 KB, `apexcharts` ≤ 170 KB (chốt sau đo ở T050, ghi lại vào spec), `NotificationsDrawer` ≤ 15 KB gzip | Spec FR-109 |
| CHK031 | T | Thống nhất: mọi spec E2E mới chạy chromium 768/1280 ở ba cấu hình; `insights-edit` thêm firefox-1280, webkit-1280 cùng origin; `insights-cross-use`, `insights-parity-ui`, `payload/*` chỉ chromium-1280 `proxy-api`; sửa SC-001, FR-100, contracts/tests §3 | Spec SC-001, FR-100; contracts/tests §3 |
| CHK032 | G | `hasEdits` gồm cả bản sao Copy To sang dashboard khác; guard bỏ qua chỉ `/insights/<id hiện tại>` nên rời sang dashboard đích cũng hỏi; Directus như vậy (`dashboard.vue:185-194`) | Spec Edge Cases |
| CHK033 | T | Đủ khi so cả: thứ tự hạng mục (categories), tên chuỗi, giá trị từng điểm, số chuỗi (bảng sr-only) + tài liệu GraphQL bằng nhau (SC-005); thêm câu vào SC-002 | Spec SC-002 |
| CHK034 | T | Bộ mẫu riêng (CHK052): collection `bo_insights_data` có `owner` m2o `directus_users` với 2 user cố định; 3 giá trị `vars_author`: [admin], [user fixture], [] | data-model §12; Spec SC-003 |
| CHK035 | G | Ghi rõ: FR-108 đo với API giả lập; thời gian thật phụ thuộc API (đã có benchmark ở BE), ngoài phạm vi; E2E chỉ đếm request | Spec FR-108, SC-007 |
| CHK036 | T | SC-004 (c) so trên activity của bộ mẫu `bo_insights_data` (lọc `collection`), so theo nhóm cùng `timestamp` như tập (không theo thứ tự trong nhóm) | Spec SC-004 |
| CHK037 | G | Q-36 duyệt trước T082 (lượt 3, chặn), Q-34, Q-35, Q-37–Q-39 duyệt trước T123 (đóng) | Spec SC-008; tasks T004 |
| CHK038 | G | Như CHK001 (Save lỗi một phần, R-56) | Spec Edge Cases |
| CHK039 | G | Không làm mới khi drawer đang mở (Directus chỉ nạp khi mở); badge không đổi (R-52) | Spec FR-071, R-52 |
| CHK040 | G | 401 khi refresh → luồng đăng xuất của 012 điều hướng `/login`, trang dashboard unmount dừng chu kỳ (`refresh-sidebar-detail.vue:39-43`) | Spec Edge Cases |
| CHK041 | G | Như CHK001: lỗi chung, hộp lỗi, staging giữ (R-56) | Spec Edge Cases |
| CHK042 | G | Lỗi quyền từng phần trong GraphQL → tile lỗi đó (FR-021); 400 cả tài liệu → gửi lại bỏ panel lỗi (FR-041) | Spec Edge Cases |
| CHK043 | G | `apexcharts` tự chèn CSS; ghi đè bằng `src/styles/apexcharts.css` chỉ dùng biến theme (`var(--color-gray-*)`, `--font-outfit`), có biến thể `.dark`; `check-raw-colors` quét file đó; toolbar tắt như Directus (`toolbar.show false` kiểm ở port) | Spec Q-35, FR-106; plan Complexity Tracking; tasks T044 |
| CHK044 | K | Directus: icon note là `<span>` + tooltip chỉ mouseenter (`v-workspace-tile.vue:292`), không tới được bằng phím. Đề xuất: app dùng nút icon có `aria-label` = note và `BoTooltip` mở khi focus (cùng vẻ ngoài); ghi "Cần xác nhận" (a11y, như 017) | Spec FR-106, "Cần xác nhận"; tasks T063 |
| CHK045 | G | Bảng sr-only + chú giải có tên chuỗi + tooltip có tên chuỗi đáp ứng "không chỉ bằng màu" cho dữ liệu; không thêm nét đứt (khác Directus); tương phản màu chuỗi với nền ≥ 3:1 (đồ họa) trong recipe Q-35 | Spec FR-106, Q-35 |
| CHK046 | K | Directus `VBadge` chỉ là `<span>`, không `aria-live`. Đề xuất: thêm vùng `aria-live="polite"` sr-only báo "N thông báo chưa đọc" khi số đổi (không đổi giao diện); ghi "Cần xác nhận" | Spec FR-070, FR-106 |
| CHK047 | G | `applyOptionsData` chèn giá trị vào object options (không chèn chuỗi GraphQL); `queryToGqlString` dựng bằng `jsonToGraphQLQuery` (escape chuỗi); quyền đọc vẫn do API; ghi câu này vào FR-053 | Spec FR-053 |
| CHK048 | G | 768: tay cầm resize chỉ chuột (ngoại lệ FR-027, cảm ứng không bảo đảm); drawer panel và drawer thông báo toàn màn (đã ghi Edge Cases) | Spec Edge Cases |
| CHK049 | G | Đo bằng `check-bundle.mjs` (gzip) trong job `quality`; vượt → CI đỏ, sửa bằng nạp lười theo loại panel (không đổi thư viện) | Spec FR-109 |
| CHK050 | G | Parity 011 đã có `_aggregated` với `groupBy: ['year(published_on)', 'month(published_on)']` (`tests/parity/src/graphql/e2e-app.test.ts:59`) và `*_func` trong filter (`read.test.ts:81-118`); `/graphql/system` aggregate chưa thấy → bộ so payload `bo_dash_system` (T110) phủ | research bảng kiểm |
| CHK051 | T | Chép `directus/packages/utils/shared/apply-options-data.test.ts` thành test chạy với bản `@directus/utils` đã cài (T001) | tasks T001, T012 |
| CHK052 | T | Collection riêng `bo_insights_data` (seed, không E2E nào ghi): `status` (string, 4 giá trị), `category`, `amount` (decimal), `qty` (integer), `happened_at` (dateTime cố định), `owner` (m2o users); `bo_dash_*` truy vấn collection này thay `bo_content` | data-model §12; tasks T016 |
| CHK053 | T | E2E thông báo dùng user tạm của `Fixtures` (014–016) làm `recipient`, tạo 3 thông báo trong `beforeAll` qua API admin và xóa ở `afterAll`; không dựa số chưa đọc của admin; seed giữ 3 thông báo admin chỉ cho dev/parity UI | Spec US6 Independent Test, FR-103; tasks T016, T096 |
| CHK054 | T | Ước lượng +8 phút/cấu hình (7 spec × ~1 phút, payload chỉ `proxy-api`); T050/T073/T102 ghi thời gian job thật; vượt 100 phút → tách shard như 016 | contracts/tests §6; tasks đóng lượt |
| CHK055 | T | Kiểm 2026-10-17: `vi-VN.json` thiếu 19/73 khóa của 6 màn (`create_dashboard`, `edit_dashboard`, `no_dashboards`, `insights`, `activity_item`, `origin`…) và 8/11 tên panel (`panels.*` chỉ có `barchart`, `label`, `list`); rơi về `en-US` như Directus (016 R10); ghi danh sách vào research R10 | research R10 |

## Thay đổi tổng hợp nếu áp toàn bộ

- Spec: sửa US3-5 (Save lỗi thoát chế độ sửa, staging giữ), FR-011, FR-012, FR-013, FR-021, FR-022, FR-023, FR-042,
  FR-050, FR-052, FR-053, FR-054, FR-063, FR-070, FR-071, FR-072, FR-074, FR-101, FR-105, FR-106, FR-108, FR-109, SC-001,
  SC-002, SC-003, SC-004, SC-008, D-108; Edge Cases thêm 8 dòng; bảng R thêm R-56 (tạo trùng khi Save lại), R-57 (drawer
  thông báo bắt lỗi); "Cần xác nhận" thêm 6 dòng (CHK005, CHK006, CHK014, CHK025, CHK044, CHK046).
- Data-model §12: collection `bo_insights_data`, 2 user cố định, thông báo E2E trên user tạm.
- Research R10: danh sách khóa `vi-VN` thiếu; bảng kiểm thêm parity 011.
- Contracts/tests §3, §5: project thống nhất, quy tắc so bảng sr-only.
- Tasks: T001 (+ `md()` cấu hình, test `applyOptionsData`), T016 (`bo_insights_data`), T044 (`apexcharts.css`), T061,
  T062, T063 (note nút), T091, T095, T096.
