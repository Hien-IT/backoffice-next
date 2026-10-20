# Release-Gate Requirements Checklist: Extensions (020)

**Purpose**: Kiểm tra chất lượng yêu cầu (đủ, rõ, nhất quán, đo được, phủ kịch bản) của spec, plan, research,
data-model và contracts trước `/speckit.tasks` và `/speckit.implement`. Đây là "unit test cho yêu cầu", không phải
test hành vi.
**Created**: 2026-10-21
**Feature**: [spec.md](../spec.md), [plan.md](../plan.md), [research.md](../research.md), [data-model.md](../data-model.md), [contracts/](../contracts/)
**Trọng tâm** (số trong ngoặc cuối dòng): (1) tương thích Directus phía API: hook, endpoint, operation, event, context
`services`, Express 5 (D-139), `/extensions`, GraphQL, sandbox; (2) nhiều instance và triển khai: sync, khóa, bus
reload, dòng settings, lb/Ingress, Helm, rollout, readiness; (3) shim web, UI, a11y: 77 component, view, directive,
inject, import map, `--theme--*`, Settings/Marketplace, Q-41..Q-46; (4) bảo mật, lỗi và phục hồi: mã bên thứ ba trong
process và trình duyệt, CSP, tarball, sandbox, cài/gỡ/reload hỏng giữa chừng.
**Độ sâu**: cổng phát hành (đủ edge case). **Người dùng checklist**: tác giả spec tự rà trước `/speckit.tasks`; lời
giải từng mục ở [release-gate-proposals.md](./release-gate-proposals.md); owner duyệt áp toàn bộ (2026-10-21, CHK013
chọn a), đã áp vào spec, plan, research, data-model, contracts nên mọi mục `[x]`.

## Requirement Completeness

- [x] CHK001 Có yêu cầu nêu app mới xử lý shared dep `directus` của API (`API_SHARED_DEPS`: "có sẵn trong `node_modules` của API") khi extension không sandbox import `directus` hoặc `directus/version`? [Gap, Spec FR-001, FR-010, Plan R1] (1)
- [x] CHK002 Có yêu cầu nêu thứ tự đăng ký listener giữa extension và hệ thống (extension trước flows như `app.ts:130-131`; nguồn local → registry → module; thứ tự sau reload) để chuỗi filter cho cùng payload ở hai app? [Gap, Spec FR-011, Plan R3] (1)
- [x] CHK003 Có yêu cầu nêu response cache (005) áp cho GET của endpoint extension như Directus (key và namespace dùng chung giữa hai app)? [Gap, Spec FR-016] (1)(2)
- [x] CHK004 Danh sách event Directus phát mà app mới phải phát (FR-011 "plan PHẢI liệt kê") đã đủ ở plan/contracts, có vị trí phát ở app mới cho từng event và đánh dấu event ngoài phạm vi? [Completeness, Spec FR-011, contracts/api.md §5] (1)
- [x] CHK005 Event `cli.before`/`cli.after` (hook `init` của CLI): FR-012 ghi "khi áp dụng", research ghi app mới không có CLI; đã có dòng khác biệt hoặc tham chiếu khác biệt có sẵn? [Gap, Conflict, Spec FR-012, Khác biệt] (1)
- [x] CHK006 Có yêu cầu cho GraphQL `extensions` khi type `directus_extensions` khai `name: NonNull` mà `ApiOutput` không có `name` (lỗi GraphQL như Directus)? [Gap, Spec FR-035] (1)
- [x] CHK007 Có yêu cầu nêu API trả gì ở `/extensions/sources/index.js` khi dựng bundle lỗi (một extension app hỏng làm rollup lỗi): 404, bundle cũ, hay bundle bỏ extension hỏng? [Gap, Exception, Spec FR-060, FR-034] (1)(4)
- [x] CHK008 Có yêu cầu cho reload hỏng giữa chừng (đã unload, load ném hoặc sync lỗi lúc đang chạy): node còn extension nào, có thoát process như lúc khởi động, `GET /extensions` có treo vì `isReloading()`? [Gap, Recovery, Spec FR-007, FR-041, Edge Cases] (2)(4)
- [x] CHK009 Có yêu cầu cho request đang chạy khi reload gỡ endpoint/hook/operation (endpoint gỡ giữa request, filter gỡ giữa transaction, flow đang chạy operation bị gỡ)? [Gap, Spec FR-007, FR-015, FR-017] (2)(4)
- [x] CHK010 Có yêu cầu nêu node bỏ lỡ tin `extensions.reload` (pub/sub không bảo đảm giao, node đang khởi động) lệch bộ extension tới khi nào, cách phát hiện và khắc phục? [Gap, Recovery, Spec FR-042, SC-003] (2)
- [x] CHK011 Có yêu cầu cho khóa `extensions-settings` khi chờ quá 30 s (bỏ khóa, lỗi khởi động, tạo dòng không khóa) và khi process giữ khóa chết? [Gap, Plan R6, R-58] (2)(4)
- [x] CHK012 Có yêu cầu khi tạo dòng registry mới phải tra id qua `list({search})` mà registry không truy cập được lúc khởi động (dòng tạo bằng uuid ngẫu nhiên, khởi động chậm theo timeout, hay lỗi)? [Gap, Exception, data-model §2, Plan R6] (2)(4)
- [x] CHK013 Có yêu cầu nâng cấp cho release Helm 019 đang chạy (HPA bật mặc định, ConfigMap chưa có `EXTENSIONS_LOCATION`): check mới chặn `helm upgrade` dù không dùng extension; đường chuyển đổi có được nêu? [Gap, Spec FR-045, contracts/deploy.md §2] (2)
- [x] CHK014 Có yêu cầu phục hồi khi một extension làm mọi pod `process.abort()` lúc nạp (crashloop toàn cụm; `EXTENSIONS_MUST_LOAD=false` không cứu): admin tắt nó bằng cách nào khi API không lên? [Gap, Recovery, Spec FR-025, Edge Cases] (2)(4)
- [x] CHK015 Có yêu cầu trạng thái và cách phục hồi khi gỡ hỏng nửa chừng (đã xóa dòng, xóa file remote lỗi) và khi cài để lại dòng "missing" (R-59)? [Gap, Recovery, Spec FR-037, R-59] (4)
- [x] CHK016 Có yêu cầu trạng thái nạp, rỗng, lỗi cho Settings > Extensions (ngoài rỗng) và Marketplace (registry chậm, 503, trang vượt số trang, extension không tìm thấy)? [Completeness, Spec FR-083, FR-086, FR-087] (3)
- [x] CHK017 Có yêu cầu nội dung phần thay thế của error boundary (FR-067): hiện gì, có tên extension không, có log, có thử lại? [Gap, Clarity, Spec FR-067, US3-6] (3)(4)
- [x] CHK018 Bộ biến CSS ngoài `--theme--*` mà extension viết cho Directus 10/11 hay dùng (`--primary`, `--border-normal`, `--background-page`, `--foreground-normal`, `--border-radius`, `--border-width`...) đã liệt kê đủ, hay chỉ phần `_variables.scss` của 11.17.4? [Completeness, Spec FR-080, data-model §8] (3)
- [x] CHK019 Có yêu cầu thứ tự xếp lớp giữa `#dialog-outlet`/`#menu-outlet` của shim và portal Reka ở `body` (dialog extension mở trong drawer Bo, menu shim trong dialog Bo)? [Gap, data-model §7] (3)
- [x] CHK020 Có yêu cầu cho focus trap khi dialog kiểu Directus (shim) lồng trong drawer/popover Reka hoặc ngược lại (Esc đóng lớp nào, Tab, trả focus)? [Gap, Spec FR-077, SC-007] (3)
- [x] CHK021 Có yêu cầu khi module extension trùng id với module nội bộ (`content`, `settings`...) hoặc route có sẵn? [Gap, Edge Case, Spec FR-070] (3)
- [x] CHK022 Có yêu cầu thời gian chờ tối đa khi app khởi động chờ `import()` bundle (API chậm hoặc treo): app bị chặn bao lâu trước khi chạy không extension? [Gap, Spec FR-061] (3)(4)
- [x] CHK023 Có yêu cầu cho extension loại `theme` hiện ở Settings > Extensions (bật tắt không có tác dụng, D-135): admin thấy gì? [Gap, Spec D-135, FR-083] (3)

## Requirement Clarity

- [x] CHK024 "trong 10 giây" của SC-003 tính từ mốc nào (response của cài/PATCH, commit DB) và đo ở node nào, bằng request gì? [Clarity, Spec SC-003, US2-1] (2)
- [x] CHK025 D-139: với từng mục (cú pháp path, API đã bỏ, `req.query` chỉ đọc...) spec có nêu kết quả mong đợi là extension không nạp được (lỗi lúc đăng ký) hay lỗi lúc chạy, để entry parity đo được? [Clarity, Spec FR-019, D-139] (1)
- [x] CHK026 Danh sách D-139 còn phần [Unverified] (path-to-regexp 8): spec có nêu cách chốt (task kiểm, cập nhật bảng trước khi đóng) và ai duyệt khi danh sách đổi? [Clarity, Spec D-139, Plan R12] (1)
- [x] CHK027 "cùng chữ ký constructor và method công khai" của `services` (FR-010) đo bằng gì (bảng service × method, test kiểu, hay chỉ extension mẫu)? [Measurability, Spec FR-010] (1)
- [x] CHK028 D-136 "trông như phần còn lại của app mới" có tiêu chí kiểm (recipe Q-44 duyệt, ảnh so sánh) hay chỉ định tính? [Measurability, Spec D-136, SC-008] (3)
- [x] CHK029 FR-076 "giữ đủ props ... method/expose" có nêu rõ các prop "nhận rồi bỏ qua" được phép (`DrawerItem.overlay`, `VForm.collabContext`...) và contract test xử lý chúng thế nào? [Clarity, Spec FR-076, SC-002, data-model §7] (3)
- [x] CHK030 "pod chỉ ready sau khi sync và nạp xong" (FR-048) có nêu thời gian tối đa (019 SC-008 < 30 s) khi bộ extension lớn (dựng bundle)? [Clarity, Spec FR-048, Plan Performance Goals] (2)
- [x] CHK031 "đóng sẵn vào image" (FR-040, FR-045, `extensions.inImage`) có định nghĩa (nguồn `module` hay thư mục `EXTENSIONS_PATH` trong image) và marketplace bị chặn thế nào khi đó? [Clarity, Spec FR-040, FR-045] (2)
- [x] CHK032 Budget bundle web (`directus-shim` "≤ 120 KB ước lượng, chốt ở T0xx", Settings ≤ 40 KB) có số chốt trước implement? [Measurability, Plan Performance Goals, contracts/tests.md §2] (3)

## Requirement Consistency

- [x] CHK033 Import map là `<script>` inline: CSP của image web (`script-src 'self' 'unsafe-eval'`, không `'unsafe-inline'`) có cho chạy không, và spec/plan có yêu cầu hash hoặc nonce cho nó (cả Vite dev)? [Conflict, Gap, Spec FR-062, contracts/deploy.md §4, contracts/web.md §1] (3)(4)
- [x] CHK034 Lượt 1 có Settings > Extensions bật tắt kèm notice "reload required" trong khi app chỉ nạp extension app từ lượt 2 và `NoticeRaw` mở rộng thuộc FR-079 (lượt 2): thứ tự lượt có mâu thuẫn? [Conflict, Plan R14, Spec FR-079, FR-084] (3)
- [x] CHK035 Lượt 1 giữ cài/gỡ `503` ("D-37 thu hẹp"): bảng khác biệt và `accepted-differences.ts` có trạng thái tạm cho lượt 1 để `guard-differences` xanh? [Consistency, Plan R14, Spec Khác biệt] (1)
- [x] CHK036 Bộ extension mẫu ở spec FR-090 và data-model §9 khớp nhau (data-model thêm `parity-endpoint-express4`, id `…0006..0013` mới so với 5 mục của fake registry)? [Consistency, Spec FR-090, data-model §9] (1)
- [x] CHK037 FR-014 ("API nhận đăng ký và kiểm tra như Directus") và D-138: embed đăng ký ở API mới có được dùng ở đâu không, và Directus khi phục vụ app có bị ảnh hưởng? [Consistency, Spec FR-014, D-138] (1)
- [x] CHK038 FR-047 (lb chỉ Backoffice cho `/extensions/sources/*`) và Directus app nếu vẫn mở ở cổng riêng của Directus: spec có nêu Directus app lấy bundle của Directus qua cổng đó? [Consistency, Spec FR-047, D-137] (2)
- [x] CHK039 Giả định "pinia 2.3.1" và mã 013–018 viết trên pinia 3: plan có yêu cầu kiểm hồi quy và tiêu chí khi gặp API chỉ có ở pinia 3? [Consistency, Assumption, Plan R1] (3)
- [x] CHK040 FR-081 "dùng chung phiên đăng nhập, hàng đợi request và refresh token" nhất quán với cấu hình cross-site (cookie phiên khác origin, `withCredentials`, CORS credentials)? [Consistency, Spec FR-081, FR-061] (3)
- [x] CHK041 Ba chỗ nói về `services` (FR-010 "các export", D-141 "không có 4 service", contracts/api.md §6) khớp nhau và khớp 41 export của Directus? [Consistency, Spec FR-010, D-141] (1)

## Acceptance Criteria Quality

- [x] CHK042 SC-001 "100 % extension trong bộ mẫu cho cùng kết quả" có định nghĩa "cùng kết quả" cho extension app (payload ghi, DOM, không lỗi console)? [Measurability, Spec SC-001, US3] (1)(3)
- [x] CHK043 SC-004 "0 request lỗi ở các route khác" có nêu tải nền (số request, thời gian) để đo được? [Measurability, Spec SC-004] (4)
- [x] CHK044 SC-007 "0 vi phạm axe, thao tác hoàn toàn bằng bàn phím" nhất quán với ngoại lệ chỉ chuột đã duyệt (kéo `VWorkspace`, `VResizeable`) và ghi ngoại lệ ở đâu? [Consistency, Spec SC-007, Plan XII] (3)

## Scenario Coverage

- [x] CHK045 Có kịch bản cài từ Directus app (8155) rồi dùng ở app mới, và cài từ app mới rồi Directus app thấy (US2 chỉ nêu theo node API)? [Coverage, Spec US2, US6] (1)(2)
- [x] CHK046 Có kịch bản cho user không phải admin: dùng extension app (interface, layout) nhưng không vào Settings > Extensions; `GET /extensions` theo quyền ItemsService? [Coverage, Spec FR-085, FR-031] (1)(3)
- [x] CHK047 Có kịch bản cho phiên share (`/shared/:id`) và trang public: extension app có nạp không, `SharedView`/`PublicView` dùng trong ngữ cảnh nào? [Coverage, Gap, Spec FR-073] (3)
- [x] CHK048 Có kịch bản `EXTENSIONS_AUTO_RELOAD=true` khi nhiều instance (watcher trên cache local đang được sync ghi): cho phép hay cấm? [Coverage, Spec FR-006] (2)
- [x] CHK049 Có kịch bản Directus và Backoffice cấu hình `EXTENSIONS_PATH`/`EXTENSIONS_LOCATION` khác nhau trên cùng storage: có yêu cầu "cùng giá trị" và có kiểm? [Coverage, Gap, Spec FR-040] (2)

## Edge Case Coverage

- [x] CHK050 Có yêu cầu khi extension định nghĩa store pinia trùng id store của app (`'sidebar-store'`, `'extensions'`, `'appStore'`...)? [Edge Case, Gap, data-model §5] (3)
- [x] CHK051 Có yêu cầu cho extension app build với Vue 3.5.24 chạy trên Vue 3.5.43 và extension build bằng `@directus/extensions-sdk` cũ hơn 17.x (Directus 10)? [Edge Case, Assumption, Plan R1] (1)(3)

## Non-Functional: Security

- [x] CHK052 Spec có nêu mô hình tin cậy: extension không sandbox chạy với toàn quyền process và DB; `MARKETPLACE_TRUST=all` cho cài extension không sandbox; trách nhiệm của admin? [Gap, Security, Spec FR-037, US7] (4)
- [x] CHK053 Có yêu cầu an toàn khi giải nén tarball (đường dẫn tuyệt đối, `..`, symlink, kích thước) và về xác minh nguồn (Directus không kiểm checksum)? [Gap, Security, Spec FR-037, Plan R7] (4)
- [x] CHK054 Có yêu cầu chống SSRF cho `request` của sandbox (deny list IP `IMPORT_IP_DENY_LIST` của 007 có áp như `getAxios` của Directus)? [Gap, Security, Spec FR-022] (4)
- [x] CHK055 Spec có ghi là rủi ro chấp nhận: `/extensions/sources/*` không cần đăng nhập (mã extension công khai) và extension app chạy với phiên của người dùng? [Assumption, Security, Spec FR-034, FR-061] (4)
- [x] CHK056 Có yêu cầu `pnpm audit`/danh sách bỏ qua cho gói mới (tar 7, rolldown beta, chokidar) và cho workspace fixture (`@directus/extensions-sdk` kéo rollup, esbuild, terser)? [Gap, Security, Plan Constitution X] (4)

## Dependencies & Assumptions

- [x] CHK057 Giả định "một process mỗi container" (để xóa khóa sync cũ lúc khởi động) có ghi thành ràng buộc triển khai, kèm hệ quả khi chạy nhiều process? [Assumption, Plan R6] (2)
- [x] CHK058 Giả định "cùng bộ file → cùng tên chunk ở mọi node" (FR-060) có nêu điều kiện đủ (cùng đường dẫn tuyệt đối `TEMP_PATH`, thứ tự đọc thư mục, phiên bản rollup)? [Assumption, Spec FR-060] (2)
- [x] CHK059 Phụ thuộc CORS của API cho `import()` cross-site (`CORS_ENABLED`, origin) có nêu cho cấu hình cross-site và hệ quả khi CORS tắt? [Dependency, Gap, Spec FR-061, contracts/web.md §1] (2)(3)
- [x] CHK060 Yêu cầu ghi dòng `directus_extensions` lúc khởi động có nhất quán với Nguyên tắc VII ("không ghi bảng hệ thống khi khởi động") hay cần ngoại lệ được duyệt? [Conflict, Constitution VII, Spec FR-003, Plan R6] (2) — thêm sau `/speckit.analyze` C1; giải: constitution 2.2.0
- [x] CHK061 SC-005 ("không extension nào cài") có môi trường đo tách khỏi env parity đang nạp bộ mẫu? [Measurability, Spec SC-005, Plan Constraints] (2) — thêm sau `/speckit.analyze` G1; giải: T026
