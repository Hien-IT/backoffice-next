# Feature Specification: Extensions (nạp extension của Directus trên API và app mới, marketplace, sandbox, nhiều instance, shim toàn bộ `v-*`)

**Feature Branch**: `020-extensions` (làm trên `main` như 012–019, không tạo branch; `specs/020-*` là thư mục feature
hiện tại theo quy tắc "thư mục số cao nhất" của `.specify/scripts/bash/common.sh`)
**Created**: 2026-10-21
**Status**: Implemented (2026-10-21; ba lượt trên `main`), chờ duyệt Q-41..Q-46 (design owner) và D-135..D-141,
R-58..R-68 (owner) trước khi đóng
**Input**: User description: "Hỗ trợ extension của Directus 11.17.4 trên API mới và app web mới: extension đã build cho
Directus chạy được mà không cần build lại. Gỡ D-37, phần extensions của D-45, phần Extensions/Marketplace của D-93. Loại
trong phạm vi: interface, display, layout, module, panel, hook, endpoint, operation, bundle; ngoài phạm vi: theme. API:
port directus/api/src/extensions (manager, get-extensions, sync, installation, sandbox, wrap-embeds); nạp hook (filter,
action, init, schedule, embed), endpoint, operation với cùng context như Directus (services, database, getSchema, env,
logger, emitter...); env EXTENSIONS_PATH, EXTENSIONS_LOCATION, EXTENSIONS_MUST_LOAD, EXTENSIONS_AUTO_RELOAD,
EXTENSIONS_SANDBOX_MEMORY, EXTENSIONS_SANDBOX_TIMEOUT; extension sandboxed chạy trong isolated-vm; /extensions trả schema
thật, PATCH bật tắt, cài gỡ từ registry (bỏ 503), GraphQL extensions và update_extensions_item theo cùng hành vi. Nhiều
instance (compose N replica, k8s nhiều pod, HPA): mọi node trong pool, cả Directus lẫn Backoffice, nạp cùng một bộ
extension; bắt buộc EXTENSIONS_LOCATION khi chạy nhiều replica và Helm kiểm tra lúc install; reload qua kênh bus chung
extensions.reload (cùng payload partialSync, origin); hook schedule dùng cùng tên lock <tên>:<index> với Directus; pod
chỉ ready sau khi sync và nạp xong. Web, tương thích hoàn toàn: nạp /extensions/sources/index.js, đăng ký lúc chạy vào
registry interface, display, layout, module, panel, operation; shim toàn bộ 77 component toàn cục v-*
(directus/app/src/components/register.ts), PrivateView, PublicView, SharedView, 7 directive toàn cục, inject useStores,
useApi (AxiosInstance), useSdk, useExtensions, shared deps vue, vue-router, vue-i18n, pinia, @directus/extensions-sdk,
biến CSS --theme--* ánh xạ sang token. Shim theo design-system/ (TailAdmin): bọc Bo* khi đã có, giữ đủ props, slot,
emit của v-*; component chưa có thì viết mới trên Reka UI và token theme, đủ trạng thái và bàn phím theo
docs/component-specs.md. Màn Settings > Extensions và Marketplace theo design-system; màn chưa có mẫu thì ghi câu hỏi
mở. Tiêu chí chấp nhận: cùng một bộ extension mẫu (mỗi loại một cái) chạy giống nhau trên Directus và app mới; hook bắn
cùng event, endpoint trả cùng response, flow có operation tùy biến cho cùng kết quả; props, slot, emit của từng v-* shim
khớp Directus; với BE 3 replica cộng 1 Directus (compose và kind): cài ở một node thì mọi node thấy, gỡ thì mọi node trả
404, hook schedule chạy một lần mỗi lượt, scale lên thì pod mới có extension trước khi ready."

**Điều kiện trước `/speckit.plan`** (Nguyên tắc XI, Governance):

- Đã xong 2026-10-21: constitution 2.1.0 bỏ "Hệ thống extension" khỏi Nguyên tắc XI (chỉ còn extension loại `theme`
  ngoài phạm vi) và thêm vào Nguyên tắc VII câu về extension khi chạy nhiều instance; owner (kiêm tech lead) duyệt.

**Đã có từ các feature trước** (khảo sát 2026-10-21, không làm lại):

- `apps/api/src/controllers/extensions.controller.ts` và `services/extensions.service.ts` (010): đủ các route của
  `directus/api/src/controllers/extensions.ts` theo cùng thứ tự; `GET /` trả dòng `directus_extensions` với `schema: null`;
  duyệt registry (`/registry`, `/registry/account/:pk`, `/registry/extension/:pk`) qua client `@directus/extensions-registry`
  đã port (`apps/api/src/extensions/registry`); cài, cài lại, gỡ trả `503`; `PATCH`, `DELETE /:pk` trả `403`;
  `/sources/:chunk` trả bundle rỗng (D-37).
- GraphQL `extensions`, `update_extensions_item` theo D-37 (011 FR-035).
- `EXTENSIONS_PATH`, `EXTENSIONS_LOCATION`, `EXTENSIONS_CACHE_TTL`, `MARKETPLACE_REGISTRY`, `MARKETPLACE_TRUST` đã đọc
  (`apps/api/src/config/supported-variables.ts`); `EXTENSIONS_MUST_LOAD`, `EXTENSIONS_AUTO_RELOAD`,
  `EXTENSIONS_SANDBOX_MEMORY`, `EXTENSIONS_SANDBOX_TIMEOUT`, `EXTENSIONS_LIMIT`, `EXTENSIONS_ROLLDOWN` đang chỉ cảnh báo.
- Emitter thật (eventemitter2) và filter/action của item, auth, schema... (005, 003, 006); `scheduleSynchronizedJob` và
  `SynchronizedClock` (007, 009); bus và lock Redis dùng chung với Directus (002); FlowManager với registry operation
  (009); isolated-vm 5.0.3 cho operation `exec` (009); service của `directus/api/src/services/index.ts` đã port ở 003–011
  trừ phần ở D-141 (8 service có file nhưng chưa vào `services/index.ts`, chưa có `MailService`, 4 service ngoài phạm vi).
- Web: registry tĩnh `apps/web/src/{interfaces,displays,layouts,panels,operations}/index.ts`, module ở
  `apps/web/src/modules` (013–018); 14 store mà `useStores` của Directus cấp đều có trong `apps/web/src/stores` (ba store thiếu thành viên: notifications, server, settings; FR-079); 31 component
  `Bo*` có cặp `v-*`, khoảng 11 component đã port với tên khác (`RenderDisplay`, `RenderTemplate`, bốn drawer, `FieldList`,
  `ErrorBoundary`, `UserPopover`, `ValueNull`, `ExportSidebarDetail`); `@directus/sdk` 21.3.0 là client duy nhất (012).
- Đóng gói (019): image API và web riêng; `deploy/compose/lb/shared-domain.conf` đưa `/admin/*` vào FE Backoffice và mọi
  path còn lại vào `api_pool` gồm Directus và Backoffice; Helm chart `deploy/helm/backoffice` với `envFrom` ConfigMap/Secret
  của Directus và các kiểm tra lúc install (FR-053, FR-076 của 019); suite `tests/parity/src/deploy` (3 replica BE + 1
  Directus) và job CI `deploy`, `deploy-k8s` (kind).

**Số đo khoảng cách của phần web** (2026-10-21, đếm bằng regex nên chỉ là xấp xỉ; plan đo lại chính xác):

| Phần extension app của Directus dùng | Hiện trạng `apps/web` |
|---|---|
| 77 component toàn cục (`directus/app/src/components/register.ts`) | 31 có cặp `Bo*`, thiếu khoảng 160 props (nặng nhất `v-select` 23, `v-button` 21, `v-input` 18, `v-menu` 18, `v-chip` 10, `v-checkbox` 9, `v-table` 8); khoảng 11 đã port với tên khác; khoảng 35 chưa có (`VList*` 6, `VCard*` 5, `VTab`/`VTabItem`/`VTabsItems`, `VBreadcrumb`, `VBadge`, `VError`, `VHover`, `VHighlight`, `VImage`, `VIconFile`, `VItemGroup`, `VItem`, `VOverlay`, `VResizeable`, `VSheet`, `VSkeletonLoader`, `VTemplateInput`, `VFieldTemplate`, `VCollectionFieldTemplate`, `VEmojiPicker`, 3 `Transition*`, `SidebarDetail`) |
| `PrivateView`, `PublicView`, `SharedView` (`directus/app/src/views/register.ts`) | Không có component toàn cục; khung TailAdmin (012, D-127, D-128) |
| 7 directive (`click-outside`, `context-menu`, `focus`, `prevent-focusout`, `input-auto-width`, `md`, `tooltip`) | Không đăng ký directive toàn cục |
| Inject `useStores`, `useApi`, `useSdk`, `useExtensions` (`directus/app/src/composables/use-system.ts`) | Store có đủ; `useApi` của Directus là AxiosInstance, `apps/web` không có axios; chưa có `useExtensions` |
| Shared deps `vue`, `vue-router`, `vue-i18n`, `pinia`, `@directus/extensions-sdk` | Bốn thư viện đầu có trong `apps/web`; chưa có chunk dùng chung cho bundle extension |
| Biến CSS `--theme--*` (173 tên theo schema `directus/packages/types/src/extensions/themes.ts`, mỗi theme mặc định phát 169; plan R9) và class toàn cục `.type-label`, `.type-note`, `.type-text`, `.type-title`, `.form-grid` | `apps/web` có 3 biến `--theme--*`; không có các class đó |

## User Scenarios & Testing *(mandatory)*

Có ba nhóm người dùng. **Admin** cài, bật tắt và gỡ extension trong Settings. **Đội vận hành** đặt extension vào storage
và chạy hệ thống nhiều instance. **Người dùng app** dùng interface, layout, module... do extension thêm vào, mà không cần
biết extension đó viết cho Directus.

### User Story 1 - Hook, endpoint, operation đã build cho Directus chạy trên API mới (Priority: P1)

Đội vận hành có sẵn extension API (hook, endpoint, operation, bundle chứa chúng) đang chạy trên Directus. Họ đặt cùng thư
mục extension cho API mới. API mới nạp và chạy chúng giống Directus: hook nhận cùng event và payload, endpoint trả cùng
response, operation chạy trong flow cho cùng kết quả.

**Why this priority**: Load balancer đưa request vào cả Directus lẫn Backoffice (`api_pool`). Nếu API mới không nạp
extension API thì cùng một request lúc chạy hook, lúc không; endpoint lúc trả 200, lúc 404. Đây là điều kiện để chạy hai
app cạnh nhau khi đã có extension (Nguyên tắc IV).

**Independent Test**: Đặt bộ extension mẫu (FR-090) vào `EXTENSIONS_PATH` của cả hai app; gửi cùng chuỗi request tới
Directus và tới API mới; so sánh response, dữ liệu ghi ra DB, activity và log của hook.

**Acceptance Scenarios**:

1. **Given** hook mẫu đăng ký `filter('items.create')` sửa payload và `action('items.create')` ghi một dòng vào collection
   log, **When** tạo item qua API mới, **Then** item lưu với payload đã sửa và dòng log giống hệt khi tạo qua Directus.
2. **Given** endpoint mẫu id `parity-endpoint-demo` với route `GET /` và `POST /echo`, **When** gọi `/parity-endpoint-demo`
   và `/parity-endpoint-demo/echo` lần lượt vào
   Directus và API mới, **Then** status, header (ngoài các khác biệt đã ghi), body giống nhau.
3. **Given** operation mẫu dùng trong một flow thủ công, **When** chạy flow trên API mới, **Then** kết quả operation,
   `$last`, log flow (`directus_revisions` của flow) giống Directus.
4. **Given** hook `init('routes.custom.before')` gắn middleware, **When** gọi một route bất kỳ, **Then** middleware chạy
   như trên Directus.
5. **Given** hook `schedule('*/1 * * * *')`, **When** chờ ba phút, **Then** handler chạy đúng ba lần trên toàn hệ thống
   (Directus và API mới cùng giành một lock).
6. **Given** extension lỗi khi nạp và `EXTENSIONS_MUST_LOAD=false`, **When** khởi động API mới, **Then** API vẫn chạy,
   log lỗi như Directus; với `EXTENSIONS_MUST_LOAD=true` thì API dừng khởi động như Directus.

---

### User Story 2 - Nhiều instance: cài ở một node, mọi node thấy (Priority: P1)

Hệ thống chạy N replica Backoffice cùng Directus sau một load balancer (compose), hoặc nhiều pod trên Kubernetes với HPA.
Admin cài, bật tắt hoặc gỡ một extension qua bất kỳ node nào. Mọi node, cả Directus lẫn Backoffice, nạp lại cùng một bộ
extension. Pod mới khi scale lên đã có đủ extension trước khi nhận request.

**Why this priority**: Nguyên tắc VII. Không có đồng bộ thì mỗi node có bộ extension riêng, và kết quả request phụ thuộc
node nhận nó.

**Independent Test**: Suite `tests/parity/src/deploy` mở rộng, chạy trên compose (3 replica BE + 1 Directus) và kind.

**Acceptance Scenarios**:

1. **Given** `EXTENSIONS_LOCATION` trỏ tới storage S3 dùng chung, **When** cài endpoint mẫu từ registry qua Directus,
   **Then** trong thời hạn của SC-003, gọi `/parity-endpoint-demo` vào từng replica Backoffice đều trả 200.
2. **Given** endpoint mẫu đã cài, **When** gỡ qua một replica Backoffice, **Then** mọi node (cả Directus) trả `404` cho
   `/parity-endpoint-demo`.
3. **Given** `PATCH /extensions/:pk` tắt một hook ở một node, **When** tạo item qua node khác, **Then** hook không chạy.
4. **Given** hook schedule mỗi phút và 4 node, **When** chờ 5 lượt, **Then** handler chạy đúng 5 lần.
5. **Given** HPA tăng từ 3 lên 5 pod, **When** pod mới báo ready, **Then** pod đó đã nạp đủ extension (gọi `/parity-endpoint-demo` vào pod
   mới ngay khi ready trả 200).
6. **Given** `replicas > 1` hoặc HPA bật mà không có `EXTENSIONS_LOCATION`, **When** `helm install` hoặc `helm upgrade`
   (kể cả release 019 đang chạy, không dùng extension), **Then** lệnh dừng với thông báo rõ như các kiểm tra FR-053/FR-076
   của 019, chỉ cách đặt `EXTENSIONS_LOCATION` hoặc `extensions.inImage=true` (FR-045, owner chọn a).
7. **Given** Directus app (cổng riêng của Directus) và app mới cùng DB, Redis, storage, **When** cài extension qua
   Settings > Marketplace của Directus app, **Then** app mới thấy nó ở Settings > Extensions và dùng được trong thời hạn
   SC-003; cài qua app mới thì Directus app thấy (dùng chéo).

---

### User Story 3 - Interface, display, layout, panel, operation app đã build cho Directus chạy trong app mới (Priority: P1)

Admin có extension app (interface, display, layout, panel, phần app của operation, bundle) đã build cho Directus. App mới
nạp chúng mà không cần build lại: interface hiện trong chọn interface của Data Model và trong form item; display trong
bảng; layout trong chọn layout của Content; panel trong Insights; operation trong trình sửa flow.

**Why this priority**: Đây là lý do owner chọn phương án A (tương thích hoàn toàn): extension có sẵn chạy được ngay.

**Independent Test**: Nạp bộ extension mẫu (mỗi loại app một cái, dùng nhiều component `v-*`, directive, inject); mở
từng màn trên app mới và trên Directus app ở cấu hình `proxy-api`; so sánh dữ liệu lưu ra (payload comparison như 014)
và hành vi bàn phím.

**Acceptance Scenarios**:

1. **Given** interface mẫu dùng `v-input`, `v-select`, `v-menu`, `v-tooltip`, `useApi`, **When** sửa field dùng interface
   đó và lưu, **Then** payload gửi đi giống Directus app với cùng thao tác.
2. **Given** display mẫu, **When** mở bảng Content, **Then** giá trị hiện ra từ display đó.
3. **Given** layout mẫu, **When** chọn layout đó ở Content, **Then** layout nhận đúng props, preset lưu `layout` và
   `layout_query`, `layout_options` như Directus.
4. **Given** panel mẫu, **When** thêm panel đó vào dashboard và lưu, **Then** dòng `directus_panels` giống Directus.
5. **Given** operation mẫu (phần app), **When** thêm operation vào flow trong trình sửa flow, **Then** form option hiện và
   lưu `options` giống Directus.
6. **Given** extension app ném lỗi khi render, **When** mở màn chứa nó, **Then** chỉ phần đó hiện notice cảnh báo
   `unexpected_error` (FR-067), phần còn lại của màn vẫn dùng được.
7. **Given** user không phải admin có quyền sửa collection dùng interface mẫu, **When** sửa field đó, **Then** interface
   extension chạy như với admin; user này không thấy Settings > Extensions và `GET /extensions` theo quyền ItemsService
   (thường `403`) như Directus.

---

### User Story 4 - Module extension có route riêng và mục trong sidebar (Priority: P2)

Admin có module extension (trang riêng, ví dụ báo cáo). App mới đăng ký route `/admin/<id>`, hiện mục trong sidebar
theo `module_bar` của settings, và dựng trang trong khung TailAdmin qua `PrivateView`.

**Why this priority**: Module là loại extension app lớn nhất (cả một màn). Cần sau khi interface, layout chạy được.

**Independent Test**: Nạp module mẫu dùng `private-view` với slot `navigation`, `actions`, `sidebar`; bật trong
Settings > Appearance (module bar); mở trang.

**Acceptance Scenarios**:

1. **Given** module mẫu đã bật trong `module_bar`, **When** đăng nhập, **Then** sidebar có mục của module (icon, tên) và
   bấm vào thì mở `/admin/<id>`.
2. **Given** module có `preRegisterCheck` trả false với user hiện tại, **When** đăng nhập, **Then** không có mục và route
   như Directus.
3. **Given** trang module dùng slot `navigation`, `actions`, `sidebar` của `private-view`, **When** mở trang, **Then** nội
   dung hiện ở sub-menu sidebar, page header, panel chi tiết của khung TailAdmin (FR-074).

---

### User Story 5 - Settings > Extensions: xem, bật tắt, cài lại, gỡ (Priority: P2)

Admin mở Settings > Extensions, thấy danh sách extension đã nạp theo nhóm loại, trạng thái, phiên bản, nguồn (local,
registry, module), extension con của bundle. Admin bật tắt, cài lại, gỡ extension từ registry.

**Why this priority**: Gỡ D-93. Không có màn này thì admin chỉ thao tác được qua API.

**Independent Test**: E2E `settings-extensions-*` ở ba cấu hình; so dữ liệu `directus_extensions` sau mỗi thao tác với
Directus app ở `proxy-api`.

**Acceptance Scenarios**:

1. **Given** có extension local, registry và bundle, **When** mở `/settings/extensions`, **Then** danh sách và nhóm giống
   Directus app (cùng dữ liệu, giao diện theo design-system).
2. **Given** một extension đang bật, **When** tắt, **Then** `PATCH /extensions/:pk` gửi đi giống Directus app và app nạp
   lại danh sách extension.
3. **Given** extension từ registry, **When** gỡ, **Then** `DELETE /extensions/registry/uninstall/:pk` và dòng biến mất.
4. **Given** extension con của bundle, **When** mở menu của nó, **Then** không có cài lại, gỡ (Directus báo "Cannot
   uninstall sub extensions of bundles separately").

---

### User Story 6 - Marketplace: duyệt registry, xem chi tiết, cài (Priority: P2)

Admin mở Settings > Marketplace, tìm extension theo tên, lọc theo loại, sắp xếp; mở trang chi tiết (readme, phiên bản
mới nhất, tương thích, tác giả, lượt tải); cài bản mới nhất; mở trang tài khoản tác giả.

**Why this priority**: Gỡ D-37 (503) và D-93. Cần US2 xong để cài ở một node mọi node thấy.

**Independent Test**: Dùng fake registry của 010 (`tests/parity` profile có registry giả); E2E cài một extension mẫu rồi
thấy nó ở Settings > Extensions và ở chỗ dùng.

**Acceptance Scenarios**:

1. **Given** `MARKETPLACE_TRUST=sandbox` (mặc định), **When** duyệt registry, **Then** request có `sandbox=true` và chỉ
   có extension sandboxed như Directus (app không hiện nhãn sandbox, như Directus 11.17.4).
2. **Given** trang chi tiết một extension, **When** bấm cài, **Then** `POST /extensions/registry/install` với
   `{ extension, version }` và sau khi xong extension dùng được ngay, không cần tải lại trang.
3. **Given** `EXTENSIONS_LIMIT` đã đạt, **When** cài thêm, **Then** lỗi giống Directus.
4. **Given** extension cài qua Marketplace của app mới, **When** mở Directus app, **Then** Directus app thấy và dùng được
   extension đó (cùng storage, cùng dòng `directus_extensions`), và ngược lại.

---

### User Story 7 - Extension API sandboxed (Priority: P2)

Extension có `sandbox.enabled: true` chạy trong isolate riêng với giới hạn bộ nhớ, thời gian và các scope đã khai báo
(`request`, `log`, `sleep`). Extension không vượt ra ngoài các quyền đó và không làm sập API.

**Why this priority**: Marketplace mặc định chỉ cài extension sandboxed (`MARKETPLACE_TRUST=sandbox`), nên US6 cần US7.

**Independent Test**: Extension mẫu sandboxed có hook, endpoint, operation; một bản vượt bộ nhớ, một bản chạy quá
`EXTENSIONS_SANDBOX_TIMEOUT`, một bản gọi URL ngoài scope.

**Acceptance Scenarios**:

1. **Given** endpoint sandboxed gọi `request` tới URL trong scope, **When** gọi endpoint, **Then** response giống Directus.
2. **Given** extension gọi URL ngoài scope, **When** chạy, **Then** lỗi giống Directus và không có request ra ngoài.
3. **Given** extension chạy quá thời gian, **When** gọi, **Then** lỗi giống Directus và các route khác vẫn phục vụ bình
   thường.
4. **Given** extension import module khác `directus:api`, **When** nạp, **Then** từ chối nạp như Directus.

---

### User Story 8 - Shim `v-*` khớp Directus, đúng design-system và a11y (Priority: P2)

Nhà phát triển extension dùng bất kỳ component toàn cục nào của Directus app. Trong app mới, component đó nhận đúng props,
slot, emit, `v-model` như Directus; hiện theo design-system TailAdmin; dùng được bằng bàn phím và trình đọc màn hình.

**Why this priority**: Nền cho US3, US4. Khác biệt props/slot/emit làm extension hỏng mà không báo lỗi.

**Independent Test**: Contract test sinh từ định nghĩa props/emits/slots của từng file trong `directus/app/src/components`
so với shim; test browser (axe) cho từng shim.

**Acceptance Scenarios**:

1. **Given** danh sách 77 component, 3 view, 7 directive, **When** chạy contract test, **Then** mọi tên đăng ký toàn cục
   có, mọi prop (tên, kiểu, mặc định), emit, slot (tên, props của slot) khớp Directus.
2. **Given** một shim, **When** chạy axe và test bàn phím, **Then** 0 vi phạm và đủ trạng thái focus-visible, disabled,
   invalid, loading, empty theo `docs/component-specs.md`.
3. **Given** chế độ tối, **When** render shim, **Then** dùng token theme, không có hex thô (Nguyên tắc XII).

---

### User Story 9 - Đối chiếu, E2E, bộ extension mẫu (Priority: P3)

Có bộ extension mẫu dùng cho mọi kiểm thử, suite parity so API mới với Directus, E2E web ở ba cấu hình, acceptance
nhiều instance.

**Why this priority**: Nguyên tắc V. Làm song song với các story trên, đóng feature khi đủ.

**Independent Test**: CI xanh ở `quality`, `parity`, `e2e-web`, `deploy`, `deploy-k8s`.

**Acceptance Scenarios**:

1. **Given** bộ extension mẫu, **When** chạy suite `tests/parity/src/extensions`, **Then** không có khác biệt ngoài các
   mục trong "Khác biệt so với Directus".
2. **Given** E2E `settings-extensions-*`, `extensions-app-*`, **When** chạy ở `proxy-directus`, `proxy-api`, cross-site,
   **Then** đều đạt.

---

### Edge Cases

- Thư mục extension thiếu `package.json` hoặc manifest sai: bỏ qua và log như Directus; `EXTENSIONS_MUST_LOAD=true` thì
  dừng khởi động.
- Extension khai báo `host` không tương thích 11.17.4: xử lý như Directus (cùng log, cùng quyết định nạp hay không).
- Cùng tên ở hai nguồn (local và registry), hoặc thư mục `.registry` trong `EXTENSIONS_PATH`: thứ tự ưu tiên như Directus.
- Endpoint trùng id với route hệ thống (ví dụ `items`): route hệ thống thắng như Directus (thứ tự mount giống).
- Dòng `directus_extensions` không có extension trên đĩa (thư mục đã xóa): `schema: null` và màn Settings hiện trạng thái
  như Directus.
- Bật tắt một extension con của bundle: chỉ phần đó bật tắt, như Directus.
- Reload đang chạy thì có yêu cầu reload mới: xếp hàng như Directus (`reloadQueue` concurrency 1, bỏ yêu cầu trùng).
- Tin `extensions.reload` do chính process gửi: bỏ qua (`origin`).
- Sync từ `EXTENSIONS_LOCATION` lỗi lúc khởi động: dừng process như Directus (`process.exit(1)`); pod không ready.
- Khóa sync `extensions-sync/<machineId>`: trong container `machineId` = sha256(hostname) nên mỗi pod một khóa (plan R6);
  app mới chạy một process Node mỗi container (D-19 của 001) và xóa khóa cũ của máy mình lúc khởi động (khóa không có
  TTL, pod khởi động lại cùng hostname sẽ treo nếu không xóa). Chạy nhiều process trong một container (PM2) không hỗ trợ.
- Hook `schedule` với cron sai: log lỗi như Directus, không đăng ký.
- Hook `embed` trả chuỗi rỗng: lỗi "Provided code is empty" như Directus.
- Sandbox lỗi nghiêm trọng (`onCatastrophicError`): Directus gọi `process.abort()`; app mới làm giống (pod bị khởi động
  lại; ghi trong Assumptions). Extension làm mọi pod abort lúc nạp (cả Directus) → crashloop toàn cụm;
  `EXTENSIONS_MUST_LOAD=false` không cứu. Phục hồi theo runbook ở tài liệu triển khai (FR-052): tắt bằng
  `UPDATE directus_extensions SET enabled = false WHERE folder = '<thư mục>'` hoặc xóa thư mục trên storage
  `EXTENSIONS_LOCATION`, rồi rollout restart.
- Extension app dùng `@/...` nội bộ của Directus app hoặc component không đăng ký toàn cục: không hỗ trợ được (Directus
  cũng không cấp cho extension); bundle lỗi thì app vẫn chạy, log cảnh báo "Couldn't load extensions" như Directus.
- Extension app dùng class toàn cục `.type-label`, `.type-note`, `.type-text`, `.type-title`, `.form-grid`: có trong app
  mới (FR-080).
- Bundle app tải chậm hoặc lỗi mạng: app khởi động không có extension, như Directus; không có timeout riêng (app cần API
  để chạy, FR-061).
- Dựng bundle lỗi phía API (một extension app làm rollup lỗi): chỉ log cảnh báo "Couldn't bundle App extensions";
  `appExtensionChunks` giữ giá trị cũ, lần đầu là rỗng nên `index.js` trả `404`, các lần sau trả bản cũ (file có thể đã bị
  ghi đè một phần, R-63). Một extension app hỏng làm hỏng cả bundle, như Directus.
- Reload hỏng giữa chừng: sync lỗi trong reload → `process.exit(1)` như lúc khởi động; lỗi nạp từng extension đi qua
  `handleExtensionError`; lỗi khác ném ra ngoài `load()` thì app mới reject lời hứa reload để `GET /extensions` không treo
  (Directus treo, R-64).
- Request đang chạy khi reload gỡ endpoint, hook, operation: request đã vào endpoint chạy nốt; filter/action đang phát
  không bị ảnh hưởng; flow gọi operation đã gỡ ở lần sau báo lỗi operation không tồn tại như 009. Không bảo đảm gì thêm,
  như Directus.
- Node bỏ lỡ tin `extensions.reload` (pub/sub không bảo đảm giao): giữ bộ extension cũ tới lần reload sau hoặc khởi động
  lại, như Directus (R-65); tài liệu triển khai: nghi lệch thì `PATCH` một extension bất kỳ (phát reload) hoặc rollout
  restart.
- Thư mục `.registry/<id>` có trên đĩa mà chưa có dòng (DB mới, chép tay) và registry không truy cập được lúc tạo dòng:
  `list({search})` ném, không extension nào nạp (hoặc thoát khi `EXTENSIONS_MUST_LOAD`), như Directus (R-66).
- Gỡ hỏng nửa chừng: Directus xóa dòng trước, xóa file sau, không bắt lỗi; xóa file trên storage lỗi thì lần sync sau các
  node tải lại thư mục và tạo lại dòng (extension "quay lại"), admin gỡ lại. Cài hỏng (R-59): dòng còn với `schema: null`,
  Settings hiện "missing", admin dùng reinstall hoặc remove.
- Tarball độc (đường dẫn tuyệt đối, `..`, symlink ra ngoài): giải nén mặc định của `tar` không ghi ra ngoài thư mục tạm;
  không kiểm checksum, không giới hạn kích thước, như Directus (R-68).
- Module extension trùng id module nội bộ (`content`, `settings`...): Directus để extension đè route; app mới giữ module
  nội bộ, bỏ extension và log cảnh báo (R-67).
- Extension định nghĩa store pinia trùng id store của app: không chặn, như Directus (định nghĩa sau đè, có thể hỏng app).
- Extension không sandbox import `directus` hoặc `directus/version` (shared dep API của Directus): app mới không có gói
  `directus`, extension lỗi lúc nạp (D-141).
- Hai replica dựng bundle lúc bộ file chưa sync xong giống nhau: node chưa xong chưa ready (FR-048) nên không nhận
  request; sau reload cả hai cùng bộ file nên cùng tên chunk (FR-060).
- User không phải admin gọi `PATCH`, cài, gỡ: `403` như Directus.
- Gỡ extension đang được dùng (interface của một field, layout của preset, panel của dashboard, operation của flow): giữ
  dữ liệu, chỗ dùng hiện trạng thái "không tìm thấy" như Directus.
- Express: Directus 11.17.4 chạy Express 4.21.2, API mới chạy Express 5.2.1. Endpoint và hook `init` nhận Router/app
  Express 5 cấu hình giống Express 4 ở chỗ làm được (FR-019); phần không làm được là D-139.

### Truy vết user story và requirement

| User story | Requirement |
|---|---|
| US1 | FR-001..FR-019 |
| US2 | FR-040..FR-052 |
| US3 | FR-060..FR-069, FR-075..FR-082 |
| US4 | FR-070..FR-074 |
| US5 | FR-031..FR-036, FR-083..FR-085 |
| US6 | FR-037..FR-039, FR-086..FR-088 |
| US7 | FR-020..FR-026 |
| US8 | FR-075..FR-082 |
| US9 | FR-090..FR-096 |

## Requirements *(mandatory)*

### Functional Requirements

**A. Nạp và vòng đời extension trên API**

- **FR-001**: API mới PHẢI tìm extension từ ba nguồn như Directus: `local` (`EXTENSIONS_PATH`), `registry`
  (`EXTENSIONS_PATH/.registry`), `module` (package trong `node_modules` của app), với cùng quy tắc đọc manifest
  (`directus:extension`), kiểm tra loại, `host`, entrypoint (`directus/api/src/extensions/lib/get-extensions.ts`). Nguồn
  `module` trong phạm vi (owner chọn A, Clarifications 2026-10-21): extension khai báo trong `apps/api/package.json` rồi
  build image; đây là cách "đóng sẵn extension vào image" của FR-040, FR-045.
- **FR-002**: Loại nạp được: `hook`, `endpoint`, `operation` (phần api), `bundle` (các mục api); phần app của các loại
  `interface`, `display`, `layout`, `module`, `panel`, `operation` đi vào bundle app (FR-060). Loại `theme` không nạp
  (D-135).
- **FR-003**: Trạng thái bật tắt đọc và ghi ở `directus_extensions` (`id`, `enabled`, `folder`, `source`, `bundle`) như
  Directus, gồm việc tạo dòng cho extension mới thấy lần đầu (`get-extensions-settings.ts`). Không thêm cột, không đổi
  định dạng (Nguyên tắc II).
- **FR-004**: Khởi động: sync (khi có `EXTENSIONS_LOCATION`), nạp, đăng ký, rồi mới báo ready (FR-048). Tắt máy: gỡ
  đăng ký (hook, endpoint, operation, job schedule, isolate) theo trình tự tắt máy của 001.
- **FR-005**: `EXTENSIONS_MUST_LOAD=true`: lỗi nạp bất kỳ extension nào làm dừng khởi động; `false`: log và bỏ qua
  extension đó (`handleExtensionError` của Directus).
- **FR-006**: `EXTENSIONS_AUTO_RELOAD=true`: theo dõi `EXTENSIONS_PATH` và nạp lại khi đổi, cùng debounce như Directus
  (500, 650, 2000 ms theo loại thay đổi); chỉ nên dùng khi dev (như Directus). Khi có `EXTENSIONS_LOCATION` watcher theo
  dõi cache local nên mỗi lần sync có thể kích reload; tài liệu triển khai ghi không bật khi nhiều instance.
- **FR-007**: Reload: một hàng đợi concurrency 1, bỏ yêu cầu trùng khi đã có một yêu cầu chờ; sau reload phát action
  `extensions.reload` với danh sách thêm, bớt như Directus; log "Extensions reloaded", "Added extensions: ...",
  "Removed extensions: ..." cùng nội dung.
- **FR-008**: `/server/info` trả `extensions.limit` theo `EXTENSIONS_LIMIT` như Directus.

**B. Hook**

- **FR-010**: Hook nhận `register` với `filter`, `action`, `init`, `schedule`, `embed` và `context` gồm `services` (các
  export của `directus/api/src/services/index.ts` cùng tên, cùng chữ ký constructor và method công khai; `MailService`
  chỉ log như D-33/D-34; bốn service ngoài phạm vi không có, D-141), `env`, `database` (Knex), `emitter` (emitter cục
  bộ của extension), `logger`, `getSchema`.
- **FR-011**: `filter`, `action`: đăng ký vào emitter chung với cùng tên event và cùng payload, meta, context mà Directus
  phát tại cùng thời điểm (mọi event đã phát ở 003–011). Danh sách event và chỗ phát ở hai app nằm ở research R3 và
  `contracts/api.md` §5; event thiếu là lỗi parity. Thứ tự đăng ký như Directus: manager khởi tạo trước FlowManager nên
  filter của extension chạy trước filter của flow; trong manager theo nguồn local → registry → module; sau reload filter
  extension đăng ký lại sau flow (Directus cũng vậy, R-62).
- **FR-012**: `init`: cùng các event init (`app.before`, `app.after`, `routes.before`, `routes.after`,
  `routes.custom.before`, `routes.custom.after`, `middlewares.before`, `middlewares.after`) với cùng đối số (app Express 5,
  FR-019). `cli.before`/`cli.after` không phát vì app mới không có CLI (D-19 của 001, D-141).
- **FR-013**: `schedule`: dùng `scheduleSynchronizedJob` với tên `<tên extension>:<index>` giống hệt Directus, để Directus
  và mọi replica cùng giành một lock; cron sai thì log lỗi như Directus.
- **FR-014**: `embed`: API mới nhận đăng ký và kiểm tra như Directus (`wrap-embeds.ts`, lỗi "Provided code is empty"),
  nhưng app web mới không chèn embed vào `index.html` (D-138, owner 2026-10-21); embed thu được không dùng ở đâu (API mới
  không phục vụ app). Directus vẫn tự thu embed của nó và chèn vào Directus app khi phục vụ app (`SERVE_APP`), không liên
  quan app mới.

**C. Endpoint**

- **FR-015**: Endpoint mount ở `/<id>` (hoặc tên thư mục bỏ phần sau `:` khi config là hàm) trên một router riêng sau các
  route hệ thống, nhận `context` như FR-010; gỡ đăng ký thì route trả `404 ROUTE_NOT_FOUND` như Directus.
- **FR-016**: Request vào endpoint đi qua cùng chuỗi middleware như Directus (authenticate, accountability, rate limit,
  cache response...), nên `req.accountability`, `req.schema` có như Directus. Cache response chỉ ghi qua `respond`; endpoint
  extension tự trả nên không được cache ở cả hai app.

**D. Operation**

- **FR-017**: Phần api của operation đăng ký vào FlowManager của 009 với cùng id; flow dùng operation đó chạy giống
  Directus (dữ liệu `$last`, log, lỗi). Gỡ thì flow dùng operation đó lỗi như Directus.
- **FR-018**: Reload flow (`flows` bus channel, 009) sau khi đăng ký hoặc gỡ operation, như Directus.
- **FR-019**: Endpoint và hook `init` nhận Router/app Express 5 của API mới, cấu hình giống Express 4 ở chỗ làm được:
  `query parser` là hàm `qs.parse` với `QUERYSTRING_MAX_PARSE_DEPTH`, `QUERYSTRING_ARRAY_LIMIT` chép từ Directus
  (`app-pipeline.ts:40-45`, `req.query` lồng như Directus); `strict routing`, `case sensitive routing` để mặc định như
  Directus; `req.params` và `req.body` cùng hình dạng với cùng request. Không cài Express 4 cạnh Express 5. Khác biệt còn lại (cú
  pháp path của Express 5: `*`, `?`, `+`, regex trong chuỗi; API đã bỏ `res.sendfile`, `app.del`, `req.param()`; lỗi
  async tự bắt) ghi thành D-139 với danh sách đầy đủ do plan lập; bộ extension mẫu (FR-090) có endpoint dùng các chỗ này
  để parity bắt được (Clarifications 2026-10-21).

**E. Sandbox**

- **FR-020**: Extension có `sandbox.enabled: true` chạy trong isolate isolated-vm với `memoryLimit =
  EXTENSIONS_SANDBOX_MEMORY` (MB, mặc định 100) và `timeout = EXTENSIONS_SANDBOX_TIMEOUT` (ms, mặc định 1000) như
  `registerSandboxedApiExtension`.
- **FR-021**: Trong isolate chỉ import được `directus:api`; import khác bị từ chối với cùng thông điệp.
- **FR-022**: SDK sandbox cấp `request`, `log`, `sleep` theo `requestedScopes` (URL, method cho `request`) với cùng kiểm
  tra và lỗi như `lib/sandbox/sdk` của Directus; `request` đi qua `getAxios()` của 007 nên deny list IP
  (`IMPORT_IP_DENY_LIST`) áp như Directus.
- **FR-023**: Hook sandboxed đăng ký được `filter`, `action`; endpoint sandboxed đăng ký route; operation sandboxed đăng ký
  handler; theo `lib/sandbox/register` của Directus.
- **FR-024**: `process.env` trong isolate chỉ có `NODE_ENV` như Directus.
- **FR-025**: Lỗi nghiêm trọng của isolate: log và `process.abort()` như Directus.
- **FR-026**: Gỡ đăng ký thì dispose isolate.

**F. `/extensions` và GraphQL**

- **FR-031**: `GET /extensions` trả mỗi extension với `id`, `bundle`, `meta` (`enabled`, `folder`, `source`, `bundle`) và
  `schema` thật (manifest đã nạp), extension con của bundle nằm trong `schema.entries` của cha như
  `services/extensions.ts` của Directus.
- **FR-032**: `PATCH /extensions/:pk` (admin) bật tắt, rồi nạp lại và phát `extensions.reload` cho các node khác như
  Directus.
- **FR-033**: `DELETE /extensions/:pk` (admin) theo đúng hành vi Directus 11.17.4.
- **FR-034**: `GET /extensions/sources/:chunk` trả các chunk của bundle app do API mới dựng (FR-060), cùng header cache
  (`EXTENSIONS_CACHE_TTL`) như Directus.
- **FR-035**: GraphQL `extensions` và `update_extensions_item` (system) trả và sửa như REST, đúng như Directus; bỏ phần D-37
  ở 011 FR-035. Type `directus_extensions` khai `name: NonNull(String)` mà kết quả không có `name` (`system-admin.ts:266`):
  truy vấn có `name` lỗi "Cannot return null for non-nullable field" như Directus.
- **FR-036**: Bỏ `NO_INSTALL` và mọi nhánh `503`/`403` của D-37 trong controller và service.

**G. Registry và cài đặt**

- **FR-037**: `POST /extensions/registry/install` (`extension`, `version`), `POST /extensions/registry/reinstall`,
  `DELETE /extensions/registry/uninstall/:pk`: tải tarball từ registry (`MARKETPLACE_REGISTRY`), chỉ bản sandboxed khi
  `MARKETPLACE_TRUST=sandbox`, giải nén vào `.registry/<versionId>`, ghi lên `EXTENSIONS_LOCATION` khi có, tạo hoặc xóa
  dòng `directus_extensions` (cả dòng con của bundle), phát `extensions.reload` với `partialSync`, nạp lại, phát action
  `extensions.installed` / `extensions.uninstalled` như Directus.
- **FR-038**: `EXTENSIONS_LIMIT`: chặn cài khi vượt, với cùng lỗi và cách đếm (bundle tính theo số mục) như Directus.
- **FR-039**: Không cài lại hay gỡ riêng extension con của bundle, không gỡ extension không phải nguồn `registry`, với cùng
  lỗi như Directus.

**H. Nhiều instance**

- **FR-040**: Mọi node trong pool (Directus và mọi replica Backoffice) PHẢI nạp cùng một bộ extension. Tài liệu triển khai
  PHẢI ghi: chạy nhiều replica thì bắt buộc `EXTENSIONS_LOCATION` trỏ tới storage dùng chung (S3 hoặc local trên volume
  dùng chung), hoặc bộ extension đóng sẵn vào mọi image và không cài qua marketplace. "Đóng sẵn" = image dẫn xuất chép
  extension vào `/directus/extensions` (`EXTENSIONS_PATH`) hoặc khai báo nguồn `module`; không có công tắc tắt marketplace
  (Directus cũng không), cài khi đó chỉ vào một pod. Directus và Backoffice PHẢI dùng cùng `EXTENSIONS_PATH`,
  `EXTENSIONS_LOCATION` (cùng ConfigMap ở Helm, cùng env file ở compose).
- **FR-041**: Sync từ `EXTENSIONS_LOCATION` về `EXTENSIONS_PATH` lúc khởi động và khi nhận `partialSync`, như
  `lib/sync/sync.ts` (so metadata, xóa file thừa, trạng thái sync trên đĩa, khóa theo máy).
- **FR-042**: Kênh bus `extensions.reload`, payload `{ partialSync?, forceSync?, origin }` giống hệt Directus (`skipSync` không bao giờ đi qua bus),
  trên cùng namespace bus (002), để Directus và Backoffice reload lẫn nhau.
- **FR-043**: Node nhận tin reload bỏ qua tin do chính process gửi (`origin`).
- **FR-044**: (gộp vào FR-013: khóa schedule cùng tên với Directus trên mọi node.)
- **FR-045**: Helm chart PHẢI dừng `helm install`/`upgrade` với thông báo rõ khi `replicas > 1` hoặc HPA bật mà không có
  `EXTENSIONS_LOCATION` trong ConfigMap/Secret của Directus, trừ khi `extensions.inImage=true`. Áp cả cho release 019 đang
  chạy (HPA bật mặc định): README và NOTES có mục "Nâng cấp từ 019" (đặt `EXTENSIONS_LOCATION` hoặc
  `--set extensions.inImage=true`) (owner chọn a ở release-gate 2026-10-21).
- **FR-046**: Compose dev (`deploy/compose`) PHẢI có `EXTENSIONS_LOCATION` trỏ tới MinIO cho cả Directus và các replica.
- **FR-047**: Chế độ chung domain: load balancer chỉ đưa `/extensions/sources/*` vào các replica Backoffice, vì bundle
  do Directus dựng trỏ tới chunk dùng chung của Directus app (`/admin/assets/<dep>.<hash>.entry.js`), không có trên FE
  Backoffice đang phục vụ `/admin` (owner 2026-10-21). Áp cho `deploy/compose/lb/shared-domain.conf` (một `location`
  riêng tới pool chỉ có Backoffice) và cho Ingress của Helm chart (path riêng tới Service của Backoffice, không qua pool
  có nhãn `backoffice.io/api-pool`). Chế độ separate-domain không đổi (`bo_pool` chỉ có Backoffice). Mọi path
  `/extensions` khác vẫn đi vào pool chung. Directus app mở ở cổng riêng của Directus gọi chính API Directus cùng origin nên
  vẫn nhận bundle của Directus; lb chỉ ảnh hưởng domain chung, nơi `/admin` là app mới. Acceptance kiểm qua log upstream
  của lb rằng không request `/extensions/sources/*` nào vào node Directus; kind kiểm Service `-api-only` không chọn pod
  Directus.
- **FR-048**: `/server/health` chỉ trả `ok` sau khi sync và nạp extension xong lần đầu; readiness probe của Helm và
  compose dùng nó (019). Với bộ extension mẫu (FR-090), từ khi container khởi động tới `/server/health` ok ≤ 60 s trên
  runner CI (019 SC-008 30 s là khi không có extension).
- **FR-049**: Trong lúc rollout có thể có node chạy hai phiên bản extension khác nhau; chấp nhận như Directus (không chặn).
  Image web và API không cần cùng commit (import map, FR-062).
- **FR-050**: Không giữ state extension quan trọng chỉ trong bộ nhớ process: trạng thái bật tắt ở DB, file ở storage dùng
  chung, reload qua bus (Nguyên tắc VII).
- **FR-051**: Suite `tests/parity/src/deploy` thêm các ca của US2 (compose 3 BE + 1 Directus, và kind), gồm ca
  `index.js` từ một replica và các chunk nó import từ replica khác đều trả 200 với cùng nội dung (FR-060).
- **FR-052**: Tài liệu triển khai (`deploy/README` hoặc tương đương) thêm mục extension: biến bắt buộc, cách cài, giới
  hạn khi không có storage dùng chung, cách thêm extension nguồn `module` (khai báo trong `apps/api/package.json`, build
  image), "đóng sẵn" (FR-040), "Nâng cấp từ 019" (FR-045), runbook phục hồi extension làm crash (Edge Cases), xử lý node lệch
  bộ extension (R-65), không bật `EXTENSIONS_AUTO_RELOAD` khi nhiều instance, ràng buộc một process mỗi container.

**I. Web: nạp bundle và đăng ký**

- **FR-060**: API mới dựng bundle app từ các extension app đang bật như `generateExtensionBundle` của Directus (rollup;
  rolldown khi `EXTENSIONS_ROLLDOWN=true`), với các shared dep trỏ tới chunk dùng chung của app web mới (FR-062). Mỗi
  node tự dựng trong process khi nạp và mỗi lần reload, lưu ở `TEMP_PATH/app-extensions` của node, như Directus (owner
  chọn A, Clarifications 2026-10-21); readiness (FR-048) chờ dựng xong. Vì bundle là hàm của bộ file đã sync, mọi node
  cùng bộ extension PHẢI cho cùng tên chunk; acceptance nhiều instance kiểm `index.js` lấy từ node này và chunk lấy từ
  node khác vẫn khớp (FR-051). Điều kiện: cùng `TEMP_PATH`, `EXTENSIONS_PATH` tuyệt đối trong mọi container (image cố
  định `/directus`), cùng phiên bản rollup, entry sinh theo thứ tự map.
- **FR-061**: App web tải `extensions/sources/index.js` lúc khởi động như `loadExtensions` của Directus, cho mọi route (cả
  trang public, share) trước khi mount; lỗi tải thì app vẫn chạy, log cảnh báo "Couldn't load extensions"; không timeout
  riêng như Directus. Cross-site: `import()` module cần CORS như SDK 012 đã cần (`CORS_ENABLED`, `CORS_ORIGIN`,
  `CORS_CREDENTIALS`), không thêm phụ thuộc. Shim (FR-075..FR-082) chỉ nạp khi bundle có extension app (import động sau
  `loadExtensions`), nên bundle chính chỉ thêm loader và import map.
- **FR-062**: Build app web PHẢI xuất chunk riêng cho từng shared dep (`vue`, `vue-router`, `vue-i18n`, `pinia`,
  `@directus/extensions-sdk`) với API giống bản Directus 11.17.4 dùng, tên có hash như Directus
  (`assets/<dep>.<hash>.entry.js`, cache `immutable` của 019 giữ nguyên), và chèn vào `index.html` một
  `<script type="importmap">` ánh xạ năm bare specifier đó tới chunk của chính nó. Bundle do API dựng giữ bare specifier
  (external, không alias), nên chạy ở mọi origin (chung domain, domain riêng, cross-site) và API không cần biết file của
  web; image API và web không cần cùng commit (owner chọn D ở plan 2026-10-21, thay C của clarify; D-140 bỏ). `pinia`
  ghim 2.3.1 như Directus (plan R1). Chỉ API Backoffice trả bundle (FR-047). Import map là script inline nên CSP của image
  web PHẢI cho phép nó bằng hash: lúc container khởi động `40-config.sh` đọc import map trong `index.html`, tính
  `sha256` và `csp.awk` thêm `'sha256-…'` vào `script-src` (không thêm `'unsafe-inline'`); thêm origin của `PUBLIC_URL`
  vào `script-src` khi là URL tuyệt đối (cross-site).
- **FR-063**: `@directus/extensions-sdk` ở runtime PHẢI cấp đúng các export của bản 17.1.4 dùng trong trình duyệt
  (`directus/packages/extensions-sdk/src/index.ts` + `@directus/composables` 11.4.1); danh sách chuẩn ở
  `contracts/web.md` §3 (gồm `define*` cả `defineOperationApi`, `defineHook`, `defineEndpoint`, `defineTheme`;
  `getFieldsFromTemplate`, `getRelationType`; mọi composable kể cả `useGroupableParent`, `createLayoutWrapper`).
- **FR-064**: Đăng ký lúc chạy: interface, display, layout, panel, operation (app) của extension được thêm vào registry
  hiện có (013, 014, 017, 018) cạnh mục nội bộ, có hydrate/dehydrate như `registerExtensions` của Directus; chỗ chọn
  (chọn interface ở Data Model, chọn layout ở Content, chọn loại panel ở Insights, chọn operation ở flow) hiện cả mục
  extension.
- **FR-065**: `useExtensions()` trả ref theo loại (`interfaces`, `displays`, `layouts`, `modules`, `panels`,
  `operations`; `themes` luôn rỗng, D-135) gồm cả nội bộ và extension, như Directus.
- **FR-066**: Option của extension (`options` dạng mảng field hoặc component) hiện trong `ExtensionOptions` (016) như
  Directus.
- **FR-067**: Mỗi chỗ render extension có error boundary: lỗi của extension chỉ làm hỏng phần đó (US3 kịch bản 6). Phần
  thay thế như Directus (`form-field-interface.vue:87-89`): notice cảnh báo `$t('unexpected_error')`, lỗi in console;
  không tên extension, không thử lại.
- **FR-068**: Tên, icon, mô tả của extension đi qua `translate` như Directus (chuỗi `$t:` dùng i18n của app).
- **FR-069**: Store extensions như Directus: tạo khi màn Settings > Extensions hoặc Marketplace dùng tới (`refresh(false)`
  lúc khởi tạo store), không hydrate sau đăng nhập; gỡ D-45 phần extensions.

**J. Module và view**

- **FR-070**: Module extension đăng ký route `/admin/<id>` con của khung app, có `preRegisterCheck` như Directus.
- **FR-071**: Sidebar hiện mục module extension theo `module_bar` của settings như module nội bộ (012, D-130 vẫn ẩn
  visual, deployments).
- **FR-072**: `system-modules` liệt kê cả module extension như Directus: `useAllModules()` của
  `apps/web/src/interfaces/_system/system-modules/modules.ts` thêm module extension; `OUT_OF_SCOPE_MODULES` (D-130) vẫn
  ẩn visual, deployments.
- **FR-073**: `PrivateView`, `PublicView`, `SharedView` đăng ký toàn cục với cùng props, slot, emit như
  `directus/app/src/views`; interface/display extension hiển thị được cả trong trang share (bundle nạp cho mọi route).
- **FR-074**: `PrivateView` (props `title`, `icon`, `iconColor`, `showBack`, `backTo`, `sidebarShadow`,
  `showHeaderShadow`; slot `navigation`, `title-outer:prepend`, `title-outer:append`, `title:prepend`, `title:append`,
  `title`, `headline`, `actions:prepend`, `actions`, `actions:append`, `sidebar`, default; `provide('main-element')`) đặt
  nội dung vào khung TailAdmin hiện tại (D-127, D-128): slot `navigation` vào sub-menu sidebar; `title`/`headline`/
  `title-outer:*`/`title:*`/icon/`actions*` vào page header ở hàng header sticky đầu `main` (tiêu đề vẫn là `main h1`);
  slot `sidebar` vào popover chi tiết (`apps/web/src/layout/DetailPanel.vue`: nút bật ở cuối page header, chỉ hiện khi
  trang có slot `sidebar`, đóng mỗi lần mở trang, không resize). Chi tiết còn lại là câu hỏi design-system Q-45
  (`design-system/docs/layout-patterns.md` §1, §4, §5, §7, §9, §12).

**K. Shim component, directive, inject, CSS**

- **FR-075**: Đăng ký toàn cục đủ 77 component với đúng tên của `directus/app/src/components/register.ts` (cả dạng
  PascalCase và kebab-case khi dùng trong template).
- **FR-076**: Mỗi shim PHẢI giữ đủ props (tên, kiểu, mặc định), emit (tên, đối số), slot (tên, props của slot),
  `v-model`, và method/expose công khai của component Directus tương ứng. Shim bọc `Bo*` khi đã có, nhưng PHẢI bổ sung phần
  `Bo*` thiếu thay vì bỏ qua. Prop "nhận rồi bỏ qua" chỉ được phép khi ghi ở data-model §7 kèm lý do (ví dụ
  `DrawerItem.overlay` khác `drawer`, `DrawerItem.popoverProps`, `VForm.collabContext`); contract test vẫn kiểm tên, kiểu,
  mặc định của chúng.
- **FR-077**: Component chưa có (34, data-model §7) viết mới trên Reka UI và token theme, đủ trạng thái focus-visible, disabled,
  invalid, loading, empty, bàn phím, nhãn và lỗi liên kết theo `design-system/docs/component-specs.md`. `VDialog`,
  `VDrawer`, `VMenu` shim dựng trên Reka (Dialog, Popover) thay focus-trap của Directus để cùng ngăn xếp focus với
  component Bo: Esc đóng lớp trên cùng, Tab vòng trong lớp trên cùng, đóng thì trả focus về activator; `#dialog-outlet`,
  `#menu-outlet` đặt sau `#app`, thứ tự lớp theo thang z-index của theme (recipe Q-44).
- **FR-078**: Đăng ký toàn cục 7 directive (`click-outside`, `context-menu`, `focus`, `prevent-focusout`,
  `input-auto-width`, `md`, `tooltip`) với cùng giá trị binding và modifier như `directus/app/src/directives`.
- **FR-079**: Provide `STORES_INJECT` (14 store: app, collections, fields, flows, insights, notifications, permissions,
  presets, relations, requests, server, settings, translations, user), `API_INJECT`, `SDK_INJECT`, `EXTENSIONS_INJECT` với
  cùng khóa inject như `@directus/constants`. Store PHẢI có cùng state, getter, action công khai như store Directus.
  Thiếu hiện nay (plan 2026-10-21): notifications (`dialogs`, `queue`, `previous`, `notifications`, `overlayIsActive`,
  `lastFour`, `setOverlayIsActive`, `add`, `hide`, `remove`, `update` → nối vào notice tại chỗ của `use-notices`, D-66),
  server (`info.extensions`, `info.ai_enabled`, `info.mcp_enabled` luôn `false`, D-17), settings (`availableAiProviders`
  trả `[]`, Nguyên tắc XI), app (`basemap` khi hydrate).
- **FR-080**: Biến CSS `--theme--*` (173 tên của schema `@directus/themes`; plan R9) và class toàn cục `.type-label`, `.type-note`,
  `.type-text`, `.type-title`, `.form-grid` có trong app mới, ánh xạ sang token TailAdmin (sáng và tối; Q-46); đè theo
  `theme_light_overrides`/`theme_dark_overrides` như 012. Chỉ định nghĩa biến Directus 11.17.4 định nghĩa (theme,
  `_variables.scss`, palette sinh ra); biến cũ của Directus 10 đã bỏ ở 11 thì cũng không có, extension dùng chúng hỏng như
  trên Directus 11.
- **FR-081**: `useApi()` trả instance có API của AxiosInstance như Directus (`get`, `post`, `patch`, `delete`, `request`,
  `interceptors`, `defaults.baseURL`...) dùng chung phiên đăng nhập, hàng đợi request và refresh token của app. Dùng axios
  1.15.0 (cùng bản Directus app và `apps/api`) cấu hình như `directus/app/src/api.ts`. Owner duyệt 2026-10-21 lệch quyết
  định "`@directus/sdk` là client duy nhất" của 012: axios chỉ dùng cho `useApi()` cấp cho extension, mã của app mới vẫn
  gọi API bằng `@directus/sdk`. Ở cross-site, axios `withCredentials: true` dùng cùng cookie và CORS credentials như SDK.
- **FR-082**: Shim không dùng hex thô hay màu palette ngoài theme (Nguyên tắc XII); chế độ tối theo class `dark`.

**L. Màn Settings**

- **FR-083**: `/settings/extensions` như `directus/app/src/modules/settings/routes/extensions`: nhóm theo loại, dòng có
  icon, tên, phiên bản, nguồn, trạng thái (bật, tắt, thiếu), extension con của bundle lồng dưới cha, menu bật tắt, cài lại,
  gỡ theo quyền; mục "Extensions" trong sub-menu Settings (gỡ D-93). Trạng thái như Directus: danh sách hiện khi có dữ
  liệu hoặc nạp xong (`extensions.vue:45`), rỗng → `no_extensions`, lỗi của store không hiện. Extension loại `theme` hiện
  và bật tắt như loại khác (không tác dụng trên app mới, có tác dụng trên Directus app; D-135).
- **FR-084**: Thao tác ở FR-083 gửi cùng request như Directus app; sau thao tác app nạp lại extension (không cần tải lại
  trang) như Directus.
- **FR-085**: Chỉ admin thấy và dùng (như Directus).
- **FR-086**: `/settings/marketplace` (registry: tìm, lọc loại, sắp `popular`/`recent`/`downloads`, phân trang),
  `/settings/marketplace/extension/:extensionId` (banner, readme markdown qua `marked` + `dompurify` như 012, metadata:
  phiên bản mới nhất, tương thích (`semver`), tác giả, giấy phép, kích thước, lượt tải; nút cài (luôn bản mới nhất, Directus
  11.17.4 không có chọn phiên bản)/đã cài → "manage"),
  `/settings/marketplace/account/:accountId`, theo `directus/app/src/modules/settings/routes/marketplace`.
- **FR-087**: Lỗi registry (không kết nối, 404) hiện như Directus (`handleRegistryError` của 010). Trạng thái Marketplace như
  Directus: spinner lần đầu, danh sách mờ khi nạp lại, hộp lỗi khi lỗi, `no_results` khi rỗng, trang vượt số trang → danh
  sách rỗng.
- **FR-088**: Chuỗi giao diện lấy từ `directus/app/src/lang` qua script sync có sẵn (012), đổi chữ Directus thành
  Backoffice (Nguyên tắc IX).

**M. Kiểm thử**

- **FR-090**: Bộ extension mẫu trong repo (`tests/fixtures/extensions`), build bằng `@directus/extensions-sdk` cùng phiên
  bản Directus 11.17.4; danh sách chuẩn ở data-model §9 (hook, endpoint, endpoint Express 4 cho D-139, operation api + app,
  interface, display, layout, module, panel, bundle, bản sandboxed của hook, endpoint, operation). Mỗi extension app dùng
  nhiều component `v-*`, directive và inject.
- **FR-091**: Suite parity `tests/parity/src/extensions`: so REST, GraphQL, DB rows (`directus_extensions`, dữ liệu do hook
  ghi), log hook giữa Directus và API mới; gỡ các entry D-37 trong `tests/parity/accepted-differences.ts` (lượt 1 thu hẹp
  còn cài, cài lại, gỡ; lượt 3 gỡ hẳn). Chữ ký `services` (export × constructor × method công khai) so bằng script đọc mã
  hai bên (trừ D-141). Unit test giải nén tarball độc (R-68).
- **FR-092**: Contract test cho shim: đọc props/emits/slots từ mã nguồn `directus/app/src/components`, `views`,
  `directives` và so với shim.
- **FR-093**: Test browser (Vitest browser + axe) cho từng shim.
- **FR-094**: E2E web `settings-extensions-*`, `settings-marketplace-*`, `extensions-app-*` ở ba cấu hình (proxy tới
  Directus, proxy tới API mới, cross-site), payload comparison với Directus app ở `proxy-api` như 014.
- **FR-095**: (gộp vào FR-051.)
- **FR-096**: Benchmark: thêm một bước đo thời gian mở app lần đầu với bộ extension mẫu vào `benchmark-web`.

### Key Entities

- **Extension**: một thư mục có manifest `directus:extension` (loại, entrypoint, `host`, `sandbox`); nguồn `local`,
  `registry` hoặc `module`.
- **Dòng `directus_extensions`**: `id` (uuid), `enabled`, `folder`, `source`, `bundle` (id của bundle cha hoặc null). Dùng
  chung với Directus, không đổi cấu trúc.
- **Bundle extension**: một thư mục chứa nhiều mục (`entries`) loại app hoặc api; mỗi mục có dòng riêng với `bundle` trỏ
  về cha.
- **Bundle app**: các chunk JavaScript API dựng từ phần app của extension đang bật, tải qua `/extensions/sources/:chunk`;
  import bare specifier năm shared dep.
- **Import map**: `<script type="importmap">` trong `index.html` của web, ánh xạ năm shared dep tới chunk entry có hash
  của chính bản build đó.
- **Tin reload**: thông điệp trên kênh `extensions.reload` với `partialSync`, `forceSync`, `origin`.
- **Lock schedule**: khóa Redis tên `<tên extension>:<index>` của `scheduleSynchronizedJob`.
- **Isolate sandbox**: môi trường chạy riêng của một extension sandboxed, có giới hạn bộ nhớ, thời gian và scope.
- **Shim**: component, view, directive toàn cục của app mới mang tên và hợp đồng của Directus app.

## Khác biệt so với Directus *(mandatory)*

Mã tiếp theo sau D-134 (019): D-135 đến D-143 (D-140 bỏ). Gỡ ở 020: D-37 (010; lượt 1 thu hẹp còn `POST
/extensions/registry/install`, `/reinstall`, `DELETE /extensions/registry/uninstall/*` trả `503`, lượt 3 gỡ hẳn), phần extension của D-17 (001), phần app extension và
Marketplace của D-41 (012), phần extensions của D-45 (012), phần Marketplace và Extensions của D-93 (016), phần extension
của 012 spec dòng 345 ("app không nạp `/extensions/sources/index.js`"), 011 FR-035.

| Mã | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại (đổi thương hiệu / ngoài phạm vi / khác) | Gỡ ở |
|----|----------|------------------|---------|-------|-----------------------------------------------|------|
| D-135 | Extension loại `theme` | Nạp, đăng ký vào danh sách theme của app, chọn được ở Appearance và trang user | API vẫn liệt kê (`GET /extensions` có `schema`), app web không nạp; `useExtensions().themes` rỗng; chọn theme vẫn theo 015 (`system-theme`, dữ liệu theme tĩnh) | Owner 2026-10-21: theme ngoài phạm vi 020; theme Directus sinh `--theme--*` lúc chạy, trùng vai trò với design-system (Nguyên tắc XII) | ngoài phạm vi | — |
| D-136 | Giao diện của component toàn cục `v-*` | Giao diện Directus app | Cùng hợp đồng (props, slot, emit), giao diện theo design-system TailAdmin; extension dùng `v-*` trông như phần còn lại của app mới | Owner 2026-10-21 (shim theo TailAdmin); Nguyên tắc XII | khác | — |
| D-137 | Nội dung và điều kiện của `/extensions/sources/*` | Chunk import shared dep bằng URL `/admin/assets/<dep>.<hash>.entry.js` của Directus app; chỉ dựng và trả khi `SERVE_APP` | Chunk giữ bare specifier (`vue`, `pinia`...) resolve qua import map của app web mới; luôn dựng và trả, không theo `SERVE_APP` (app web là image riêng); cùng extension, cùng hành vi, khác mã sinh | FR-060, FR-062; ở chế độ chung domain chỉ replica Backoffice trả các chunk này (FR-047). Lượt 1 (trước T142) app mới vẫn trả bundle rỗng của 010 khi `SERVE_APP`, Directus trả bundle bộ mẫu: entry D-137 tạm cho body `/extensions/sources/index.js`, chunk khác 404 ở app mới | khác | — |
| D-140 | (bỏ ở plan 2026-10-21) API nhúng manifest tên chunk của web, hai image cùng commit | — | Thay bằng import map (FR-062): không còn khác biệt với Directus ngoài D-137; số D-140 không dùng lại | Owner chọn D khi research cho thấy manifest hỏng ở domain riêng và cross-site | — | bỏ |
| D-141 | Phần Directus ngoài phạm vi mà extension có thể dùng | 41 export của `services/index.ts`, `MailService` gửi email; gói `directus` (export `./version`) trong `node_modules` của API; CLI `directus` với event `cli.before`/`cli.after` | Không có gói `directus` (extension import nó lỗi lúc nạp); không CLI nên không phát `cli.*` (D-19 của 001); `services` không có `WebSocketService`, `DeploymentService`, `DeploymentProjectsService`, `DeploymentRunsService` (gọi tới → `TypeError`); `MailService.send` phát filter `email.send` rồi ghi log thay vì gửi (D-33/D-34); phía web `serverStore.info.ai_enabled`/`mcp_enabled` luôn `false`, `settingsStore.availableAiProviders` rỗng, `v-form` bỏ qua `collabContext` | Nguyên tắc XI (realtime, deployment, AI ngoài phạm vi), D-17 | ngoài phạm vi | — |
| D-139 | Express cấp cho endpoint và hook `init` | Express 4.21.2 | Endpoint (thường và sandbox) chạy trên một app Express 4.21.2 (`express4`, alias npm) gắn trong app Express 5 của Nest (`apps/api/src/extensions/lib/endpoint-app.ts`, cùng `trust proxy`, `query parser`, `req.body` `{}` như Directus): cú pháp path Express 4, `req.param()`, `res.send(status)`, gán `req.query`, `req.host` không port, body, handler async bị reject (treo như Directus) đều như Directus (đo 2026-10-21 trên hai fixture và extension registry `dirserve`). Còn khác: hook `init` nhận `{ app }` là app Express 5 của Nest, nên route extension tự đăng ký trên `app` vẫn theo Express 5 (cú pháp path path-to-regexp 8, API đã bỏ, `req.query` chỉ đọc, `req.host` giữ port). `path-to-regexp` của Express 4 override lên 0.1.13 (GHSA-37ch-88jc-xwx2) | Nguyên tắc VI (NestJS 12 trên Express 5, 001). Owner chọn cách 2 ngày 2026-10-21 (Express 4 riêng cho endpoint) sau khi extension registry `dirserve` (route `/*`) không nạp trên Express 5; thay lựa chọn B trước đó | khác | — |
| D-138 | Hook `embed` (mã chèn vào `<head>`, `<body>` của app) | Chèn vào `index.html` của Directus app khi API phục vụ app | API nhận đăng ký và kiểm tra như Directus, app web mới không chèn; Directus app vẫn có embed | App web mới là image nginx tĩnh (019); owner chọn không hỗ trợ (Clarifications 2026-10-21) | khác | — |
| D-142 | Lớp chồng và vị trí so với khung app (rà CSS 2026-10-21) | Header bar `z-index` 5/7 dính trong vùng cuộn; dialog 500/600, menu 600 qua outlet; `--header-bar-height` là phần đầu vùng cuộn; `v-dialog` dùng focus-trap (chặn click ra ngoài) | Sidebar `z-99999`, header `z-999` ngoài vùng cuộn: overlay của extension có `z-index` 10–700 nằm dưới chúng; dialog, menu, drawer cùng `z-99999`, cái mở sau nằm trên; `--header-bar-height` vẫn 4.5rem dù header ở ngoài vùng cuộn; dialog Reka đặt `pointer-events: none` cho `body` (phần extension gắn vào `body` không nhận hover, cuộn). Còn lại, chỉ hình thức hoặc hiệu năng: tay nắm cropper nhỏ hơn, vùng emoji theo chiều cao của thư viện, không ẩn drawer chồng quá 5 lớp, nút của dialog không xếp dọc dưới 640px (app từ 768px, L-1), không có rule `.tooltip` | Đổi `z-index` khung app hoặc offset có thể làm vỡ dropdown, overlay của cả app; chưa có extension thật bị ảnh hưởng. Sửa khi gặp extension cụ thể | khác | — |
| D-143 | Header dính của danh sách Roles, Policies | `v-table fixed-header` | Bảng không có header dính (trang không `fill`, đã ghi ở `RolesCollectionRoute.vue`, `PoliciesCollectionRoute.vue`) | Danh sách ngắn; ghi lại mã cho đủ hồ sơ | khác | — |

Owner duyệt D-142, D-143 ngày 2026-10-21 (đề xuất sau khi rà CSS so với Directus).

Owner duyệt toàn bộ D-135 đến D-141 (D-140 đã bỏ), gồm kết quả đo D-139 (`res.send(201)` trả 200), ngày 2026-10-21
(T202).

**Cần xác nhận và rủi ro giữ như Directus** (plan và release-gate 2026-10-21, owner duyệt áp toàn bộ; R-58 đến R-68
owner duyệt lại 2026-10-21, T202):

- R-58: `directus_extensions` không có unique `(source, folder)`; N node khởi động cùng lúc có thể cùng chèn dòng cho một
  extension local mới. App mới khóa Redis `extensions-settings` giữa các node Backoffice (research R6): thử mỗi 250 ms tối
  đa 30 s; quá hạn thì log cảnh báo, xóa khóa (có thể kẹt do process chết khi giữ) và tạo dòng không khóa; node Directus
  khởi động cùng lúc vẫn có thể chèn trùng.
- R-59: `install` tạo dòng `directus_extensions` trước khi tải; tải lỗi thì dòng còn lại (Directus không transaction).
- R-60: nút Install của app khóa khi `GET /extensions` (gồm dòng con) `>= EXTENSIONS_LIMIT`, server đếm extension cấp 1;
  `account.vue` tính số trang bằng `Math.round`.
- R-61: Directus `offInit(name, handler)` không gỡ listener `init` (lỗi); app mới gỡ đúng. Không thấy từ ngoài vì init
  chỉ phát lúc khởi động.
- R-62: sau reload, filter của extension đăng ký lại sau filter của flow (thứ tự khác lúc khởi động), như Directus.
- R-63: dựng bundle lỗi thì giữ danh sách chunk cũ, file trong `TEMP_PATH/app-extensions` có thể đã bị ghi đè một phần.
- R-64: lỗi ném ra ngoài `load()` trong reload làm `GET /extensions` treo ở Directus (lời hứa reload không settle); app mới
  reject để không treo.
- R-65: node bỏ lỡ tin `extensions.reload` lệch bộ extension tới reload sau hoặc khởi động lại; không đối soát.
- R-66: thư mục registry chưa có dòng mà registry không truy cập được → không extension nào nạp.
- R-67: module extension trùng id module nội bộ: Directus để extension đè; app mới giữ module nội bộ, bỏ extension.
- R-68: tarball registry không kiểm checksum, không giới hạn kích thước.

## Câu hỏi mở về design-system (Nguyên tắc XII)

Như 014–018: recipe nháp vào `design-system/docs/` trước khi code, design owner duyệt trước khi đóng 020. Dùng lại Q-2
(bảng), Q-3 (lưới thẻ), Q-7 (tìm và lọc), Q-8 (page header, notice), Q-9 (panel), Q-22 (drawer). Design-system chưa có mẫu
cho các mục dưới.

| Mã | Câu hỏi | Trạng thái |
|----|---------|------------|
| Q-41 | Settings > Extensions: dòng extension (icon, tên, phiên bản, nguồn, nhãn trạng thái), nhóm theo loại, bundle lồng, menu dòng, trạng thái nạp và rỗng (FR-083) | Duyệt (owner + design owner, 2026-10-21) |
| Q-42 | Marketplace registry: ô tìm, lọc loại, sắp xếp, dòng extension (icon, tên, chip loại và "installed", mô tả, tác giả có dấu verified, ngày cập nhật, lượt tải, giấy phép), phân trang | Duyệt (owner + design owner, 2026-10-21) |
| Q-43 | Marketplace trang extension và trang tài khoản: banner, readme, cột metadata (sparkline lượt tải, phiên bản mới nhất, tương thích, giấy phép, kích thước, link), nút cài/manage và trạng thái, trang tài khoản; trạng thái nạp, nạp lại, lỗi, rỗng (FR-087) | Duyệt (owner + design owner, 2026-10-21) |
| Q-44 | Recipe cho các component mới của shim (plan data-model §7: họ list, card, item group, tab tách rời, breadcrumb, badge, skeleton, overlay, resizeable, highlight, hover, image, icon file, emoji picker, template input, field template, sheet, error, transition) và các component dùng chung mới (`BoPopover` cho `v-menu`, dialog không tiêu đề cho `v-dialog`, select có nhóm/divider); thang z-index và ca lồng (menu shim trong dialog Bo, dialog shim trong drawer Bo; FR-077); ảnh từng shim sáng/tối (SC-008) | Duyệt (owner + design owner, 2026-10-21) |
| Q-45 | `PrivateView` trong khung TailAdmin: ánh xạ 11 slot và 7 prop (FR-074); `PublicView` (`wide`), `SharedView` (`title`, `inline`) | Duyệt (owner + design owner, 2026-10-21) |
| Q-46 | Ánh xạ 173 biến `--theme--*` và class `.type-*`, `.form-grid` sang token theme cho sáng và tối (FR-080) | Duyệt (owner + design owner, 2026-10-21) |

## Clarifications

### Session 2026-10-21

- Q: Mức tương thích của extension app? → A: Phương án A, tương thích hoàn toàn: extension đã build cho Directus chạy
  không cần build lại; shim toàn bộ `v-*`, view, directive, inject, shared deps, `--theme--*`.
- Q: Loại extension trong phạm vi? → A: Mọi loại trừ `theme` (D-135).
- Q: Cài, gỡ từ marketplace? → A: Có; bỏ `503` của D-37.
- Q: Extension API sandboxed? → A: Có, isolated-vm như Directus.
- Q: Giao diện của shim? → A: Theo design-system TailAdmin, không chép CSS của Directus (D-136).
- Q: Extension API có phải chạy trên API mới không? → A: Có, và trên mọi node của pool, vì `api_pool` có cả Directus lẫn
  Backoffice.
- Q: Hook `embed` trên app web mới? → A: Không hỗ trợ; API vẫn nhận đăng ký (FR-014, D-138).
- Q: `/extensions/sources/*` ở chế độ chung domain? → A: Load balancer và Ingress chỉ đưa path này vào replica Backoffice
  (FR-047).
- Q: `useApi()` dùng gì? → A: axios 1.15.0 như Directus app; owner duyệt lệch quyết định "SDK là client duy nhất" của 012,
  axios chỉ dùng cho `useApi()` của extension (FR-081).
- Q: Endpoint và hook `init` viết cho Express 4 chạy trên Express 5 thế nào? → A: Express 5 cấu hình giống Express 4 ở
  chỗ làm được, phần còn lại ghi D-139 có danh sách; không cài Express 4 cạnh Express 5 (FR-019).
- Q: API biết đường dẫn chunk dùng chung của app web bằng cách nào? → A (clarify): Build API nhúng manifest tên chunk
  (có hash) của web; image API và web cùng commit (D-140). **Đổi ở plan cùng ngày** (dòng dưới).
- Q: Nguồn `module` (package npm trong `node_modules` của API) có trong phạm vi không? → A: Có; thêm bằng cách khai báo
  trong `apps/api/package.json` rồi build image, ghi trong tài liệu triển khai (FR-001, FR-052).
- Q: Dựng bundle app ở đâu? → A: Mỗi node tự dựng trong process khi nạp hoặc reload như Directus; readiness chờ dựng
  xong; acceptance kiểm `index.js` và chunk từ hai node khác nhau vẫn khớp (FR-060, FR-051).
- Q (plan 2026-10-21): shared dep cho bundle app? → A: Import map trong `index.html` của web, bundle API giữ bare
  specifier; bỏ C/D-140 vì manifest hỏng ở domain riêng và cross-site (FR-062, research R4).
- Q (plan 2026-10-21): bản `pinia` cho chunk dùng chung? → A: Ghim 2.3.1 như Directus (research R1).
- Q (release-gate 2026-10-21): Helm check `EXTENSIONS_LOCATION` chặn cả `helm upgrade` của release 019 đang chạy? → A:
  Có (a), kèm mục "Nâng cấp từ 019" ở README và NOTES (FR-045). Owner duyệt áp toàn bộ 59 lời giải release-gate.
- Q (`/speckit.analyze` 2026-10-21): ghi dòng `directus_extensions` lúc khởi động có vi phạm Nguyên tắc VII? → A: Sửa
  constitution 2.2.0 (phương án a): ngoại lệ duy nhất cho dòng extension mới thấy, như Directus, có khóa Redis. Owner áp
  toàn bộ 18 phát hiện của analyze.
- Q: Chia lượt implement thế nào? → A: Ba lượt lên `main` lần lượt khi xanh: API + nhiều instance (+ Settings >
  Extensions chỉ đọc, bật tắt) → web shim + nạp bundle + module → marketplace cài gỡ; cài từ registry mở ở lượt 3
  (Assumptions).

## Assumptions

- Phiên bản thư viện theo Directus 11.17.4 (Nguyên tắc về phiên bản của các feature trước): rollup 4.59.0, rolldown
  1.0.0-beta.31 (chỉ khi `EXTENSIONS_ROLLDOWN=true`), isolated-vm 5.0.3 (đã có), `@directus/extensions-sdk` và
  `@directus/composables` 11.4.1 cùng bản Directus 11.17.4; `pinia` 2.3.1 (plan R1).
- Bộ extension mẫu build một lần, commit bản đã build cùng mã nguồn, giống fixture của 013.
- Registry thật không dùng trong CI; dùng fake registry của 010, thêm tarball của extension mẫu.
- `process.abort()` khi isolate lỗi nghiêm trọng giữ như Directus; trên Kubernetes pod được khởi động lại.
- Theo dõi file (`EXTENSIONS_AUTO_RELOAD`) chỉ cho dev, như Directus; không kiểm trong acceptance nhiều instance.
- Khối lượng lớn: implement theo ba lượt, mỗi lượt lên `main` khi CI xanh như 004 (owner chọn A, Clarifications
  2026-10-21). Lượt 1: API nạp hook, endpoint, operation, sandbox; nhiều instance (sync, reload, Helm, compose, acceptance);
  `GET /extensions` trả `schema`; `PATCH`, `DELETE /:pk`; Settings > Extensions chỉ đọc và bật tắt; cài, cài lại, gỡ từ
  registry vẫn `503` (D-37 thu hẹp, chưa gỡ); `NoticeRaw` mở rộng và notice "reload required" của store extensions cũng
  ở lượt 1. Lượt 2: web nạp bundle, shim toàn bộ, registry lúc chạy, module,
  `PrivateView`. Lượt 3: marketplace (API cài, cài lại, gỡ; màn Marketplace; menu cài lại, gỡ ở Settings > Extensions);
  gỡ hẳn D-37. Như vậy `main` ở mọi mốc không có extension app đã cài mà app mới chưa nạp.
- Owner kiêm tech lead và design owner (2026-10-20): duyệt khác biệt, recipe và sửa constitution.
- Mô hình tin cậy: extension không sandbox là mã có toàn quyền process, DB, env, secret; `MARKETPLACE_TRUST=sandbox` (mặc
  định) chỉ cho cài từ marketplace bản sandboxed; `all` là quyết định của người vận hành; chỉ admin cài, gỡ, bật tắt.
- Rủi ro chấp nhận như Directus: `/extensions/sources/*` công khai (mã extension app ai cũng tải được); extension app chạy
  trong trang với phiên người dùng; CSP giữ `'unsafe-eval'`.
- Extension build cho Vue 3.5.x chạy được trên Vue 3.5.43; Directus không kiểm `host` khi nạp (chỉ hiện "compatibility" ở
  Marketplace), nên extension build cho Directus 10 nạp nếu module chạy được, như Directus 11.17.4.
- Gói mới của `apps/api`, `apps/web` đi qua job `security` (`pnpm audit --prod`); workspace fixture là devDependency
  private, ngoài `--prod`; advisory phải bỏ qua (nếu có) ghi `auditConfig` kèm lý do.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % extension trong bộ mẫu (FR-090) cho cùng kết quả trên Directus và app mới: suite parity extensions có 0
  khác biệt ngoài D-135 đến D-141. "Cùng kết quả": extension API → status, body, header (ngoài khác biệt), dòng DB, log
  hook bằng nhau; extension app → payload ghi bằng nhau (bộ so 014), 0 lỗi console, kịch bản E2E đạt trên cả Directus app
  và app mới.
- **SC-002**: 77/77 component, 3/3 view, 7/7 directive, 4/4 inject có trong app mới; contract test khớp 100 % props,
  emit, slot với Directus 11.17.4 (trừ các thành viên ngoài phạm vi của D-141).
- **SC-003**: Với 3 replica Backoffice cộng 1 Directus (compose và kind): sau khi cài, gỡ hoặc bật tắt ở một node, mọi node
  phản ánh thay đổi trong 10 giây (mốc: nhận response của request cài/gỡ/`PATCH`; đo: mỗi 500 ms gọi endpoint mẫu hoặc
  `GET /extensions` vào từng node qua cổng riêng của node); hook schedule chạy đúng 1 lần mỗi lượt trong 10 lượt liên tiếp; pod mới khi scale lên
  trả đúng endpoint extension ngay khi báo ready.
- **SC-004**: Extension lỗi hoặc sandboxed vượt giới hạn: 0 request lỗi ở các route khác trong lúc đó (trừ ca
  `process.abort()` có chủ đích của FR-025, kiểm riêng), đo với tải nền 30 s, 10 kết nối vào `/server/ping` và
  `GET /items/bo_ext_items`, ≥ 1.000 request, 0 non-2xx.
- **SC-005**: Không có extension nào cài (env benchmark không đặt `EXTENSIONS_LOCATION`): các benchmark hiện có (`benchmark`, `benchmark-system`, `benchmark-web`...) không
  chậm hơn ngưỡng đang dùng (10 % và 25 ms cho web).
- **SC-006**: Với bộ extension mẫu, thời gian mở app lần đầu trên app mới không chậm hơn Directus app quá ngưỡng của
  `benchmark-web` (10 % và 25 ms).
- **SC-007**: Mọi shim và màn mới: 0 vi phạm axe, thao tác được hoàn toàn bằng bàn phím, trừ ngoại lệ chỉ chuột đã duyệt
  ở `design-system/qa/handoff-checklist.md` (kéo tile `VWorkspace`, như 017/018); `VResizeable` có bàn phím trên tay cầm.
- **SC-008**: Design owner duyệt Q-41 đến Q-46 trước khi đóng feature; recipe Q-44 kèm ảnh từng shim (sáng, tối) trong
  `design-system/docs` (không so ảnh với Directus, D-136).
- **SC-009**: CI xanh ở `quality`, `parity`, `e2e-web` (chromium, firefox, webkit), `deploy`, `deploy-k8s`.
