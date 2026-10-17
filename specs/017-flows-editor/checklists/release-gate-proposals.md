# Lời giải cho release-gate 017

Owner yêu cầu áp toàn bộ (2026-10-17). Mỗi mục: lời giải ngắn và nơi đã sửa. Hành vi Directus kiểm bằng đọc mã nguồn
2026-10-17 (`logs-sidebar-detail.vue`, `logs-drawer.vue`, `options-overview.vue`, `flow.vue:163-186, 310-384`,
`flow-drawer.vue:129-151`, `overview.vue:116-140`, `v-workspace.vue:76-86`, `v-workspace-tile.vue:119-130`,
`composables/use-revisions.ts:160-185`, `packages/errors/src/errors/internal.ts`).

| Mục | Lời giải | Sửa ở |
|-----|----------|-------|
| CHK001 | Như `flow-drawer.vue:148-151`: lỗi → hộp lỗi (`showUnexpectedError`), drawer còn mở, giá trị giữ, nút hết loading | Spec FR-012 |
| CHK002 | Như `overview.vue:125-140`: lỗi → hộp lỗi, không đổi store (bảng giữ trạng thái cũ), không nạp lại | Spec FR-013, FR-014 |
| CHK003 | Như `flow.vue` (`try/catch`, staging chỉ xóa sau `hydrate` thành công): staging giữ, chế độ sửa giữ; Save lần sau tính lại và gửi lại cùng `PATCH /operations` (idempotent) rồi `PATCH /flows`; tải lại trang mất staging và thấy link đã null → R-47 | Spec Edge Cases, FR-030, R-47 |
| CHK004 | Như `flow.vue:167-181`, `options-overview.vue:18`: panel Trigger hiện tiêu đề `t('triggers.<type>.name')` (khóa thô khi null/lạ), không overview; drawer tab 2 không chọn mục nào, form rỗng; Save ở tab 1 gửi `trigger` và `options` như store (không xóa) | Spec Edge Cases |
| CHK005 | Như Directus: store chỉ nạp khi đăng nhập và sau ghi; flow mới của app kia → không tìm thấy tới khi tải lại trang; E2E dùng chéo tải lại trang trước khi mở | Spec Edge Cases, FR-102 |
| CHK006 | `bo_all_ops` chỉ chạy nhánh không tác dụng phụ: resolve `condition → log → transform → sleep(10) → json-web-token(sign, secret literal) → item-read(bo_content key 1) → exec (trả {}) → trigger(bo_child)`; reject của `condition` → `throw-error`; sáu operation có tác dụng phụ (`item-create`, `item-update`, `item-delete`, `request`, `mail`, `notification`) nằm ở chuỗi dưới reject của `log` (không bao giờ chạy); `request` trỏ `http://127.0.0.1/` | Spec FR-103, data-model §9 |
| CHK007 | Không E2E nào chạy `bo_all_ops`; chỉ seed chạy 3 lần; E2E khác dùng flow tạm `web-e2e-<cfg>-*`; seed lại (payload) tạo lại 3 log | Spec FR-100, FR-103, contracts/tests §3 |
| CHK008 | en-US: "Backoffice does not send email. This operation only writes a log entry and returns success." vi-VN: "Backoffice không gửi email. Operation này chỉ ghi log và trả kết quả thành công."; "Backoffice" là tên sản phẩm (IX) | Spec FR-041 `mail`, D-106 |
| CHK009 | Như `options-overview.vue:28`: nút sao chép chỉ hiện khi `isCopySupported`; kết quả dùng `use-clipboard` (đã có) với `copy_raw_value_success`/`copy_raw_value_fail`, hiện bằng notice tại chỗ (D-45) | Spec FR-022 |
| CHK010 | Mọi chuỗi người dùng nhập hiện bằng nội suy chữ (không `v-html`), như Directus; JSON log qua `JSON.stringify` trong `<pre>` | Spec FR-022, FR-052 |
| CHK011 | Focus: Edit Flow → nút Save; Save thành công hoặc Clear Changes → nút Edit Flow; Done ở drawer operation → panel vừa tạo/sửa; xóa panel → panel cha hoặc Trigger | Spec FR-106 |
| CHK012 | Danh sách lấy từ store (có thể cũ); `POST /operations` lỗi (flow đích đã xóa) → hộp lỗi, hộp Copy To còn mở | Spec FR-028, Edge Cases |
| CHK013 | Một dạng: `${getApiUrl()}flows/trigger/<id>` (`getApiUrl()` kết thúc bằng `/`, như `getPublicURL()` của Directus); ở `cors` là origin API; SC-004 (c) so phần đường dẫn `/flows/trigger/<id>` | Spec US2-1, FR-012, Edge Cases, Assumptions, SC-004 |
| CHK014 | `abbreviateNumber` của `@directus/utils` (đã có), không theo locale, như Directus | Spec US4-1 |
| CHK015 | Như `use-revisions.ts:160-185` (014 đã port): nhóm ngày `date-fns_date_short(_no_year)`, giờ `date-fns_time` theo ngôn ngữ người dùng, giờ địa phương trình duyệt | Spec US4-2 |
| CHK016 | Sửa theo Directus: đang nạp là `BoProgressLinear indeterminate` (không skeleton); chấm bước: mặc định và `resolve` màu chính, `reject` màu phụ (`unknown` = màu chính) | Spec FR-004, US4-4, FR-052 |
| CHK017 | Trạng thái một lần chạy = trạng thái bước cuối (`use-revisions.ts:171`); lọc giữ dòng `status === 'reject'` trên trang hiện tại | Spec US4-3, data-model §8 |
| CHK018 | Directus `internal.ts` và `libs/errors/src/errors/internal.ts` cùng `INTERNAL_SERVER_ERROR`, 500, "An unexpected error occurred."; web chép danh sách `ErrorCode` (CHK050) | Spec FR-041, research R1 |
| CHK019 | Đơn vị ô lưới, cả hai trục: sửa = `(x + width + 25) × 18`, xem = `(x + width − 1) × 18` (`v-workspace.vue:76-86`); SVG mũi tên = biên panel xa nhất + 100 px | Spec US2-3, FR-021 |
| CHK020 | Bộ so chuẩn hóa thứ tự khóa của object; mảng giữ thứ tự trừ `operations.create/update/delete` sắp theo `key`; R4 chỉ giữ thứ tự cho dễ đọc | Spec FR-101, research R4 |
| CHK021 | Như Directus: vào `/settings/flows` không gọi API (0 request); store nạp ở đăng nhập và sau ghi | Spec FR-010, FR-108 |
| CHK022 | Khóa phẳng `operations_mail_not_sent_notice` ở overlay | Spec FR-041 |
| CHK023 | FR-109 thêm registry ≤ 25 KB, drawer log ≤ 15 KB gzip | Spec FR-109 |
| CHK024 | Cùng danh sách ở FR-106 và Complexity Tracking; ngoại lệ ghi ở `design-system/qa/handoff-checklist.md` | Spec FR-106, plan |
| CHK025 | Drawer log không `persistent` (`logs-drawer.vue:72-77`), đóng bằng Esc/ngoài; hộp Copy To thường | Spec FR-006 |
| CHK026 | Màu chính `brand-500`/tối `brand-400`, màu phụ `orange-500`/tối `orange-400` áp cho mũi tên, tay cầm, header panel con reject, icon log, chấm bước | Spec US2 (đoạn đầu), FR-052 |
| CHK027 | Bảng truy vết thêm ngoại lệ a11y canvas (FR-106) và R-47 | Spec Truy vết |
| CHK028 | Đã khớp: FR-016 (#178–#180, #33), FR-032 (#179, #181, #182), FR-054 (#183, #184); FR-110 nêu số | Spec FR-110 |
| CHK029 | Directus đặt vị trí tile bằng biến CSS `--pos-x`, `--pos-y` (ô lưới) trên `.v-workspace-tile`; Backoffice đặt `data-pos-x`, `data-pos-y` trên `[data-panel-key]`; E2E đọc hai bên | Spec SC-002, contracts/components §6 |
| CHK030 | Đo: `generateArrows` cho 50 panel < 8 ms mỗi lần di chuyển (thay "60 fps") | Spec FR-108 |
| CHK031 | SC-004 không so màu (đọc `innerText`); notice D-106 nằm ở drawer, không ở panel; URL webhook so phần đường dẫn | Spec SC-004 |
| CHK032 | Mốc: body ghi tay trên Directus app 8155 ở T002 (`payload/baselines/flows-*.json`), test unit dùng cùng file; chuẩn hóa: id thật → `key`, 5 ký tự ngẫu nhiên → `*` | Spec SC-006 |
| CHK033 | Tech lead duyệt ngoại lệ trong `handoff-checklist.md` trước khi đóng, ghi ở bảng trạng thái khác biệt của spec | Spec SC-008, SC-010 |
| CHK034 | Người không admin: module Settings không đăng ký (012 `preRegisterCheck`), URL rơi vào màn không tìm thấy của app như 016; admin luôn qua quyền `directus_operations` | Spec Edge Cases |
| CHK035 | Select `trigger.flow` hiện giá trị thô khi flow không còn hoặc đổi trigger (như `select-dropdown`); overview hiện id thô | Spec Edge Cases |
| CHK036 | Nhiều "+" trước Save được phép; con của operation tạm lồng trong cây `create`; pencil mở operation tạm theo id `_…` | Spec US2-12 |
| CHK037 | US2-6 thêm hai ví dụ: nối reject vào điểm nhận đang có cha resolve, nối Trigger vào operation đang có cha | Spec US2-6 |
| CHK038 | `async` và `error_on_reject` do 014 xử lý (notice thành công ngay hoặc lỗi); 017 thêm một flow tạm `async` trong E2E manual | Spec US5-4 |
| CHK039 | Không tự nạp; người dùng tải lại trang hoặc chuyển trang log (như Directus) | Spec FR-055 |
| CHK040 | `options` null → overview gọi với `{}`; drawer mở với `{}` | Spec Edge Cases |
| CHK041 | Không giới hạn số operation; canvas lớn theo biên; perf chỉ cam kết tới 50 | Spec Edge Cases |
| CHK042 | `data` null hoặc thiếu `steps` → không bước, trạng thái không phải resolve (icon `cancel`), drawer chỉ bước Trigger | Spec Edge Cases |
| CHK043 | Log cũ vẫn hiện (lọc theo `item`, không theo `accountability`) | Spec US4-5 |
| CHK044 | Cắt dòng một hàng với dấu "…": ô bảng (`BoTable`), tiêu đề trang (`PageHeader`), tiêu đề panel (tooltip key giữ) | Spec Edge Cases, Q-30 |
| CHK045 | Pointer events như Directus, không xử lý cảm ứng riêng (`touch-action` mặc định): kéo trên máy tính bảng cảm ứng không bảo đảm; E2E chỉ chuột; ghi trong ngoại lệ a11y | Spec Edge Cases, FR-106, Assumptions |
| CHK046 | FR-106 nêu màu tối: lưới `gray-800`, panel `gray-900` viền `gray-800`, mũi tên `-400`, `<pre>` nền `gray-900` | Spec FR-106 |
| CHK047 | Chỉ admin; chuỗi `--redacted--` hiện nguyên; không che thêm (như Directus) | Spec FR-052 |
| CHK048 | Nếu webkit flake với kéo pointer: đánh `test.fixme` cho webkit ở các test kéo, ghi lý do trong spec trạng thái; SC-001 nêu ngoại lệ này | Spec SC-001, Assumptions |
| CHK049 | Seed thử lại `POST /flows/trigger/:id` tối đa 10 lần cách 500 ms khi lỗi "flow không có" (bus reload chưa tới); `fixtures-seed` bỏ `directus_revisions`/`directus_activity` khi so | Spec FR-103 |
| CHK050 | Web không phụ thuộc lib workspace (cần build `dist`, kéo `@backoffice/types`): chép danh sách `ErrorCode` vào `operations/throw-error/error-codes.ts` (nguồn `directus/packages/errors/src/codes.ts`) với test so `libs/errors/src/codes.ts` | research R1, plan, contracts |
| CHK051 | "Cần xác nhận": RTL, `trigger-detail.vue`, request "created", chuỗi literal; tech lead xác nhận khi duyệt bảng khác biệt | Spec Khác biệt, SC-010 |
| CHK052 | T002 thử dữ liệu vòng trên Directus app: treo → giữ D-105; không treo → bỏ D-105 và làm giống | Spec Edge Cases (T002 xong 2026-10-17: không treo, D-105 bỏ, R-48) |
