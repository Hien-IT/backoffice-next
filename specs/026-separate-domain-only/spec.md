# Feature Specification: Backoffice chạy cạnh Directus chỉ ở domain riêng (bỏ chế độ chung domain của 019)

**Feature Branch**: `026-separate-domain-only` (làm trên `main` như 012–025, không tạo branch; `specs/026-*` là thư mục
feature hiện tại theo quy tắc "thư mục số cao nhất" của `.specify/scripts/bash/common.sh`)
**Created**: 2026-10-28
**Status**: Draft
**Input**: User description: "Bỏ hẳn chế độ "chung domain" của spec 019 (FR-050: một domain, /admin → FE Backoffice, các
path khác → pool gồm Directus + replica BE). Khi Backoffice chạy song song với Directus (chung DB, Redis, storage), hai
bản PHẢI ở hai domain riêng: Directus giữ domain, /admin, Ingress, Deployment của nó và không vào pool API; Backoffice
(FE + BE nhiều replica) ở domain riêng, pool API chỉ gồm replica BE, chỉ đặt riêng PUBLIC_URL (FR-071), kiểm tra cookie
domain khi cài (FR-076). Chế độ domain riêng (US9, FR-070..FR-076) trở thành chế độ duy nhất khi có Directus; chế độ
standalone (021, không Directus) giữ nguyên. Thay đổi compose mặc định, lb conf, Helm (mode shared, Ingress, label
apiPool, checks, kind test), bộ test tests/parity/src/deploy, CI deploy/deploy-k8s, benchmark, deploy/README; các route
bo_pool của 020 (D-137 /extensions/sources) và 025 (D-189.7 /permissions/me, /backoffice/) không còn cần khi Directus
không ở trong pool. Ghi rõ FR nào của 019 bị thay (FR-045 Ingress chung một domain, FR-050, Q1, câu cuối FR-070, SC liên
quan) và thêm dòng "revised by 026" vào 019."

**Đã có từ các feature trước** (khảo sát 2026-10-28):

- Chế độ domain riêng của 019 (US9, FR-070..FR-076) đã chạy và có test: override compose
  `deploy/compose/docker-compose.separate-domain.yml` + `lb/separate-domain.conf` (Directus `http://localhost:8090` có
  `/admin` của Directus, Backoffice `http://localhost:8091`), `deploy/helm/backoffice/values-separate-domain.yaml`, test
  `tests/parity/src/deploy/separate-domain.test.ts`, lượt `DEPLOY_MODE=separate-domain` của job CI `deploy`.
- Chế độ chung domain (mặc định hiện tại): `docker-compose.yml` + `lb/shared-domain.conf` (pool `api_pool` gồm Directus
  và replica BE, pool `bo_pool` cho route riêng của 020/025), chart: Service API chọn pod theo nhãn
  `backoffice.io/api-pool`, Service `-api-only` và đường dẫn Ingress riêng cho `/extensions/sources`, `/permissions/me`,
  `/backoffice/`, kịch bản kind (`ci/kind-test.sh`) gắn nhãn pool cho Deployment Directus và gọi Backoffice qua host của
  Directus (`ci/deps.yaml` không có nhãn pool).
- Chế độ standalone (021): `docker-compose.standalone.yml` + `lb/standalone.conf`, Helm `mode: standalone`.
- `.github/workflows/benchmark.yml` không dùng `deploy/compose` (từ "shared" trong file chỉ là "shared runner").

**Phần của các spec trước bị thay**:

| Nguồn | Nội dung cũ | Thay bằng (026) |
|-------|-------------|-----------------|
| 019 FR-050, Clarifications Q1 | Pool API gồm cả replica BE lẫn Directus; Directus vào pool bằng nhãn chung trên pod | FR-001, FR-002: pool chỉ gồm replica BE |
| 019 FR-070 câu cuối | "Chế độ chung domain (FR-050) vẫn là mặc định" | FR-001: domain riêng là bố cục duy nhất khi có Directus |
| 019 FR-045 | "Ingress chung một domain" | FR-007: Ingress của domain Backoffice |
| 019 FR-046 | Không biến Directus nào trong chart "trừ ... ở chế độ domain riêng (`PUBLIC_URL`)" | FR-003: `PUBLIC_URL` luôn đặt riêng khi chạy cạnh Directus |
| 019 FR-052 | Định tuyến `/auth/login/<saml>` về Directus trên Ingress chung | FR-010 |
| 019 FR-065, FR-075 | Test domain riêng là lượt CI riêng | FR-012: bộ test mặc định chạy trên bố cục domain riêng |
| 019 US2 kịch bản (một load balancer trên một cổng), US7 mô tả và kịch bản 2 (Ingress chung một domain) | Một domain cho cả hai app | US1, US2 của 026 |
| 019 Edge case "Directus trong pool khi tắt máy" | Directus trong pool cần khoảng trễ trước khi tắt | Bỏ: Directus không ở trong pool |
| 019 Key Entities "Load balancer / Ingress: một domain" | Một domain | Mỗi app một domain |
| 019 bảng env: `PUBLIC_URL`, `REFRESH_TOKEN_COOKIE_DOMAIN`/`SESSION_COOKIE_DOMAIN`, `AUTH_*_REDIRECT_ALLOW_LIST` ("chế độ domain riêng"); `WEBSOCKETS_ENABLED` (lý do "Directus trong cùng pool") | Chỉ áp cho chế độ domain riêng | Áp cho mọi bản chạy cạnh Directus; lý do của `WEBSOCKETS_ENABLED` không còn |
| 019 SC-009 | "= 0 ở chế độ chung domain, và đúng 1 (`PUBLIC_URL`) ở chế độ domain riêng" | SC-004: đúng 1 |
| 019 US1 ("chạy ngang hàng với các instance Directus còn lại"), SC-004 (0 dòng ngoài image) | Đổi image ngay trong pool Directus | Q7: service đổi image phục vụ domain Backoffice; chỉ image và `PUBLIC_URL` |
| 020 FR-047, ghi chú của D-137 | Ở chế độ chung domain chỉ replica Backoffice trả `/extensions/sources/*` (route riêng) | FR-009: không cần route riêng |
| 025 D-189.7 | Lb chung domain và Ingress gửi `/permissions/me`, `/backoffice/` tới Backoffice | FR-009: gỡ D-189.7 |

**Rà soát chỗ lệch luồng Directus vì chung domain** (FR-015; lượt đầu 2026-10-28 quét bằng từ khóa "chung domain",
"shared-domain", "same origin", "pool", "rơi vào Directus" trên `specs/001..025` và comment code; `/speckit.plan` quét
lại đủ):

Kết quả (lượt đầu và lượt đủ của `/speckit.plan` 2026-10-28, `research.md` R7): chỉ phần định tuyến của lb và Ingress
(020 FR-047, 025 FR-031/D-189.7, đã ở FR-009) và nhãn pool của chart (FR-006) được thêm riêng vì chung domain. Không có
code nào trong `apps/api`, `apps/web`, `libs` lệch luồng Directus vì chung domain; không dòng "Gỡ" nào chạm `apps/*`.
Các chỗ còn lại là câu chữ giả định "hai app sau một load balancer, request rơi vào instance nào cũng được", hoặc tiền
đề của bộ parity và môi trường test, giữ nguyên.

| Nguồn | Nội dung | Xử lý (026) |
|-------|----------|-------------|
| 020 FR-047, Clarifications "`/extensions/sources/*` ở chế độ chung domain", ghi chú D-137 | Lb, Ingress chỉ đưa `/extensions/sources/*` vào replica Backoffice | Gỡ (FR-009) |
| 025 FR-031, D-189.7, Clarifications "Lb, Ingress?" | Lb, Ingress đưa `/permissions/me`, `/backoffice/` về Backoffice | Gỡ (FR-009) |
| 020 FR-040, "Why this priority" của US nạp extension, Clarifications "Extension API có phải chạy trên API mới không?" | Mọi node trong pool (cả Directus) nạp cùng bộ extension vì lb đưa request vào cả hai | Sửa chữ: yêu cầu giữ (hai app chung DB, dòng `directus_extensions`, hook chạy ở app nhận request); lý do không còn là chung pool |
| 023 Edge case shared-domain, D-184 (câu "Ở shared-domain"), Clarifications, Assumption "gọi qua lb shared-domain" | Request qua lb có thể rơi vào Directus và nhận 403 | Sửa chữ: qua domain Backoffice luôn tới BE; gọi thẳng domain Directus vẫn nhận 403 như Directus |
| 024 Edge case, câu "ở shared-domain request tới Directus không bị chặn", bảng khảo sát dòng 12, D-188, Clarifications, Assumption | Request qua lb rơi vào Directus không bị toggle chặn | Sửa chữ: qua domain Backoffice luôn bị chặn; gọi thẳng domain Directus không bị chặn (toggle chỉ có ở Backoffice, như nay) |
| 025 D-189.1 (câu "Ở shared-domain"), bảng khảo sát dòng 17 và đoạn dưới bảng, Clarifications | Import, export rơi vào Directus không bị chặn | Sửa chữ như dòng 024 |
| 025 Edge case `/permissions/me` thiếu `import`, `export`; FR-034 | Web theo luật Directus khi API là Directus (E2E proxy tới Directus, request rơi vào Directus, cache của Directus) | Sửa chữ: bỏ lý do "request rơi vào Directus"; code FR-034 giữ (cấu hình E2E proxy tới Directus và response cache chung vẫn còn) |
| 025 Edge case link share cũ, US5 kịch bản 2 | Ở shared-domain `/admin/` tới Backoffice web nên link share của Directus app không mở được | Sửa chữ: link mở được ở domain Directus (Directus app); trong Backoffice web vẫn not found (D-189.4 giữ: yêu cầu chủ dự án, không vì domain) |
| 020 "Đã có" (shared-domain.conf, `api_pool`), US2 intro, FR-062 "Chỉ API Backoffice trả bundle (FR-047)" | Tả bố cục chung lb, trỏ FR-047 | Sửa chữ: một ghi chú mỗi chỗ |
| 021 FR-083, FR-072 (override `separate-domain`), FR-080 ("chế độ chung của 019") | `apiPool`, `extraPaths` cho Directus là tùy chọn không dùng ở standalone; override domain riêng | Sửa chữ: ghi chú theo các value và file còn lại sau FR-005, FR-006, FR-010 |
| 025 FR-033 (deploy test "cho định tuyến lb"), Clarifications "Duyệt 2026-10-28 (kể cả định tuyến lb/Ingress)" | Test định tuyến lb của D-189.7 | Sửa chữ: test thành "trả ở domain Backoffice" (`contracts/tests.md`) |
| 003 US intro ("song song sau một load balancer"), US1 Why, US2 Why ("refresh rơi vào instance kia"), Edge case SSO callback rơi vào bên kia | Luồng giữa hai app sau một lb | Sửa chữ: giữa các replica BE vẫn đúng; giữa hai app là token và cookie `openid.*`/`oauth2.*` ký `SECRET` chung (Nguyên tắc IV, 3.3.0); code là bản port Directus; ghi chú ở US intro và edge case |
| 003 D-24, Assumption "hệ thống có user SAML phải định tuyến `/auth/*` về Directus" | Định tuyến SAML trong một lb | Sửa chữ: user SAML dùng Directus app ở domain D (Q1); ghi chú tại D-24 và Assumption |
| 004 US intro ("song song sau một load balancer", "app Directus trỏ vào app mới") | Bố cục chung lb | Sửa chữ: một ghi chú (app Directus trỏ vào app mới = E2E qua proxy, FR-106) |
| `tests/parity/accepted-differences.ts` D-189.7 (`kind: 'doc'`, reason "The shared-domain lb and the Ingress send ...") | Lý do của khác biệt đã gỡ | Sửa chữ: reason ghi "gỡ bởi 026" (giữ id) |
| 007, 008, 009, 010 Assumptions "hai app cùng `PUBLIC_URL`" (tiền đề của bộ parity) | Hai app cùng `PUBLIC_URL` | Giữ, không ghi chú: parity env dùng chung `.env`; khi chạy cạnh Directus hai app khác `PUBLIC_URL` (019 FR-071, FR-003) → edge case "PUBLIC_URL khác nhau" |
| 001 "API mới thay được Directus sau load balancer", D-08..D-13 | Thay image; `/admin` 404 ở API | Giữ như hợp đồng image (Q7), hành vi API |
| 004 SC-007 (`.env` nguyên), 005 FR-013 (Referer `PUBLIC_URL/admin`), 008 FR-042 và 010 FR-044 (link `PUBLIC_URL/admin/...`) | `.env`, `PUBLIC_URL` của từng app | Giữ: compose đặt `PUBLIC_URL` ở `environment`; link mang domain của app ghi, cả hai domain hợp lệ |
| 021 FR-070, FR-103, FR-104, US5-4, US6-4/5 ("chế độ chung", "không có Directus trong pool") | So với chế độ chung của 019 | Giữ: "chế độ chung" = `mode: shared`/compose mặc định cạnh Directus |
| 004–010 FR E2E "app Directus qua reverse proxy" (`tests/directus-app-e2e`) | Directus app gọi route của API mới trên một origin | Giữ: test parity API (Nguyên tắc III, V), không phải bố cục triển khai |
| 012 FR-071 (ba cấu hình E2E), SC-001 của 014–018 | Web chạy với API Directus, API mới cùng origin, khác origin | Giữ: môi trường test (Assumptions); "cùng origin" là FE với BE của Backoffice |
| 014 "Cần xác nhận": localStorage "(khác origin `/admin` chỉ khi cùng domain ...)", link share "(cùng reverse proxy)" | Ghi chú nhắc trường hợp cùng domain | Sửa chữ: ghi chú D-39 giữ (Nguyên tắc IX, không vì domain); link share đã bị 025 D-189.4 thay |
| 024 D-188.4, 025 D-189.2, D-189.4 (response cache, bỏ share) | Bỏ đọc cache khi tắt tìm kiếm; cache `/permissions/me` không đổi; không share | Giữ: vì Redis và response cache dùng chung, yêu cầu chủ dự án; không vì domain |
| Code `apps/api/src`, `apps/web/src`, `apps/web-e2e`, `libs`, `tests/parity/src` (trừ `deploy`), `tests/directus-app-e2e`: các nhánh và comment "khi API là DR" (FR-034 của 025, `use-duplicate.ts`), "cùng origin"/`cors`, route `/extensions/sources`, `/permissions/me`, `/backoffice/permissions`, "every node of the pool" | Xử lý khi API là Directus, origin FE–BE, route của Directus | Giữ: lý do còn lại là cấu hình E2E `proxy-directus`, response cache chung (D-189.2), origin FE–BE của Backoffice, bản port Directus; không nhánh nào vì "request có thể rơi vào Directus" (danh sách file ở `research.md` R7) |

## User Scenarios & Testing *(mandatory)*

Người dùng chính là đội vận hành và lập trình viên dựng môi trường. Người dùng cuối thấy hai địa chỉ: Directus app ở
domain của Directus, Backoffice app ở domain của Backoffice; dữ liệu giống nhau ở cả hai.

### User Story 1 - Compose dev dựng Directus và Backoffice ở hai domain bằng một lệnh (Priority: P1)

Lập trình viên chạy lệnh khởi động mặc định của `deploy/compose` (không thêm file override) và có: Directus ở một domain
(cổng) với Directus app ở `/admin`; Backoffice (FE + BE nhiều replica) ở domain (cổng) khác; chung Postgres, Redis, MinIO.

**Why this priority**: Đây là môi trường dev hằng ngày và môi trường chạy bộ test chấp nhận (FR-012).

**Independent Test**: `docker compose up` với file mặc định trên máy sạch; đăng nhập ở `D/admin` (Directus app) và
`B/admin` (Backoffice app); xem log load balancer: request của domain B chỉ tới replica BE.

**Acceptance Scenarios**:

1. **Given** máy chỉ có Docker và `.env` mẫu, **When** chạy lệnh khởi động mặc định, **Then** mọi service healthy;
   domain D trả Directus app ở `/admin`, domain B trả Backoffice app ở `/admin`.
2. **Given** hệ thống đang chạy, **When** gọi API ở domain B (đọc, ghi, upload TUS, kể cả `/extensions/sources/*`,
   `/permissions/me`, `/backoffice/*`), **Then** mọi request tới replica BE, 0 request tới Directus (log lb); `Location`
   của TUS nằm ở domain B.
3. **Given** cùng file env cho Directus và BE, **When** so env của hai service, **Then** chỉ khác `PUBLIC_URL`.
4. **Given** cần 3 replica, **When** chạy lệnh khởi động với số replica 3, **Then** hệ thống chạy BE 3 replica cộng 1
   Directus, không sửa file; từng instance gọi thẳng được (FR-044 của 019).
5. **Given** override standalone (021), **When** chạy như trước, **Then** hành vi không đổi: Backoffice một mình ở cổng
   8090, không mở 8091, env của replica bằng env của `bootstrap` (`PUBLIC_URL` của `.env`), bộ test standalone đạt.

---

### User Story 2 - Helm chart cạnh Directus chỉ phục vụ domain Backoffice (Priority: P1)

Đội vận hành cài chart vào namespace đang có Directus, khai báo ConfigMap/Secret của Directus và domain Backoffice.
Chart tạo Deployment, Service, Ingress, HPA của Backoffice; Directus giữ nguyên Deployment, Service, Ingress, domain.

**Why this priority**: Môi trường thật; đây là thay đổi chính của yêu cầu.

**Independent Test**: Cài chart trên cụm kind cạnh một Directus (không nhãn pool); gọi domain B: `/admin` tới FE, path
khác tới BE; gọi domain D: Directus trả như trước; manifest của Directus không đổi.

**Acceptance Scenarios**:

1. **Given** values không có domain Backoffice, **When** cài hoặc nâng cấp chart ở `mode: shared`, **Then** chart dừng
   và báo tên value cần đặt và mục tài liệu.
2. **Given** chart đã cài với domain B, **When** gọi `B/admin/...` và `B/items/...`, **Then** request thứ nhất tới FE,
   thứ hai tới replica BE; `B/extensions/sources/*`, `B/permissions/me`, `B/backoffice/*` do BE trả.
3. **Given** một pod Directus vẫn mang nhãn pool cũ `backoffice.io/api-pool`, **When** gửi tải tới domain B, **Then** 0
   request tới pod Directus đó (endpoints của Service API không chứa IP pod đó).
4. **Given** ConfigMap/Secret chung có `REFRESH_TOKEN_COOKIE_DOMAIN` hoặc `SESSION_COOKIE_DOMAIN` không phủ host B,
   **When** cài hoặc nâng cấp, **Then** chart dừng và báo như FR-076 của 019.
5. **Given** `mode: standalone` (021), **When** cài như trước, **Then** hành vi không đổi.

---

### User Story 3 - Chuyển một bản đang chạy chung domain sang domain riêng (Priority: P2)

Đội vận hành có bản cài theo chế độ chung domain của 019 (Directus trong pool, Ingress của chart giữ domain Directus).
Họ làm theo tài liệu để chuyển Backoffice sang domain riêng và trả domain cũ về Directus.

**Why this priority**: Chỉ cần khi đã có bản chung domain; tôi không xác minh được có môi trường nào như vậy.

**Independent Test**: Kịch bản 1 trên kind (CI): `helm upgrade` một release `mode: shared` với values không có domain
Backoffice dừng, `generation` của Deployment không đổi. Kịch bản 2, 3 kiểm tay theo tài liệu trên một cụm có bản 019
(không CI: cần chart bản cũ và Ingress của Directus; tôi không xác minh được có môi trường nào như vậy).

**Acceptance Scenarios**:

1. **Given** release chung domain cũ, **When** `helm upgrade` với values cũ (không domain Backoffice), **Then** chart
   dừng, không đổi tài nguyên nào, thông báo nêu value cần đặt và mục chuyển đổi.
2. **Given** làm đủ các bước của tài liệu, **When** nâng cấp xong, **Then** domain D do Directus phục vụ toàn bộ (gồm
   `/admin` của Directus), domain B do Backoffice phục vụ; không mất dữ liệu (số dòng các bảng hệ thống và collection mẫu
   trước và sau bằng nhau).
3. **Given** user đã đăng nhập ở domain cũ qua Backoffice app, **When** mở domain B, **Then** user đăng nhập lại (cookie
   theo domain), phiên cũ vẫn hợp lệ ở Directus.

---

### Edge Cases

- **User SAML**: Backoffice không có SAML (D-24 của 003). Ở chung domain, user SAML đăng nhập qua Directus rồi dùng
  Backoffice app nhờ cookie cùng domain. Ở domain riêng, cookie của domain D không gửi tới domain B, nên user SAML
  không dùng được Backoffice app. User SAML chỉ dùng Directus app ở domain D (Clarifications Q1); tài liệu ghi rõ.
- **Biến cookie có domain trong env chung**: trước đây bản chung domain cài được; nay mọi bản cạnh Directus dừng ở FR-076
  cho tới khi chủ dự án sửa env Directus (bỏ biến, hoặc domain cha phủ cả D và B).
- **SSO**: IdP và `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` (và `AUTH_ALLOWED_PUBLIC_URLS`) phải có URL của domain B (edge case
  của 019 nay áp cho mọi bản cạnh Directus).
- **Response cache dùng chung**: response có URL theo host (`/server/specs/oas`) cache ở domain này có thể trả ở domain
  kia; giữ như 019 (Nguyên tắc III).
- **WebSocket**: Directus bật `WEBSOCKETS_ENABLED` được ở domain D mà không ảnh hưởng domain B; `/websocket` ở domain B
  vẫn do BE trả như 019.
- **Thay image một service Directus** (US1 của 019): image vẫn thay được (env, volume, probe, uid như 019); service đã
  thay image phục vụ domain B và đặt riêng `PUBLIC_URL`, không ở trong pool của domain D (Q7).
- **Pod Directus còn nhãn pool cũ** sau khi chuyển: không nhận request của domain B (US2 kịch bản 3).
- **`PUBLIC_URL` khác nhau giữa hai app** (đã vậy ở 019 US9, nay là bố cục duy nhất): link trong thông báo mention
  (008), link mời và share (010), `Location` của TUS (007), callback SSO mang domain của app ghi request; cả hai domain
  hợp lệ, không chuyển hướng chéo. Bộ parity (`tests/parity`) vẫn chạy hai app chung `.env` (tiền đề của 007–010), không
  đổi.

### Truy vết user story và requirement

| User story | Requirement |
|------------|-------------|
| US1 | FR-001..FR-005, FR-009, FR-011, FR-012 |
| US2 | FR-001..FR-004, FR-006..FR-009, FR-011, FR-012 |
| US3 | FR-006, FR-013 |
| Không US (rà soát spec trước) | FR-014, FR-015 |

## Requirements *(mandatory)*

### Functional Requirements

**Bố cục khi chạy cạnh Directus**

- **FR-001**: Khi Backoffice chạy cạnh Directus (compose mặc định, chart `mode: shared`), Backoffice PHẢI ở domain riêng.
  Repo KHÔNG còn cấu hình nào (danh sách và ngoại lệ ở SC-001) đặt hai app chung một domain hoặc đưa Directus vào pool
  API của Backoffice. Thay FR-050 (phần pool), Q1, câu cuối FR-070 của 019.
- **FR-002**: Ở domain Backoffice: `/admin` và `/admin/*` vào FE; mọi path khác (cả `/`) vào pool chỉ gồm replica BE.
  Giữ FR-051 của 019 (body, timeout, header chuyển tiếp) và FR-035 (lỗi kết nối chuyển replica khác).
- **FR-003**: Bản Backoffice PHẢI dùng nguyên env chung và chỉ đặt riêng `PUBLIC_URL` (FR-071 của 019 thành quy tắc chung);
  FE gọi API ở chính domain của nó (FR-072). Thay phần "chế độ domain riêng" của FR-046 và bảng env của 019.
- **FR-004**: Directus PHẢI giữ domain, Directus app ở `/admin`, Deployment, Service, Ingress của nó; compose và chart
  KHÔNG định tuyến request nào của domain Directus tới Backoffice.

**Compose**

- **FR-005**: Lệnh khởi động mặc định của `deploy/compose` (không file override) PHẢI dựng bố cục FR-001: Directus ở
  `http://localhost:8090` qua lb (domain D, Directus app ở `/admin`), Backoffice ở `http://localhost:8091` (domain B),
  Directus gọi thẳng ở `8095`; env chung giữ `PUBLIC_URL=http://localhost:8090`, chỉ service Backoffice đặt
  `PUBLIC_URL=http://localhost:8091` (Q3). Từng instance gọi thẳng được (FR-044 của 019), số replica đổi lúc chạy
  (FR-043). Override domain riêng gộp vào mặc định và không còn là file riêng. Override standalone (021) và
  shared-extensions (020) vẫn chạy.

**Helm chart**

- **FR-006**: Value `mode: shared` (021) giữ tên, nghĩa là "chạy cạnh Directus, chung DB"; comment trong `values.yaml` và
  README ghi rõ nghĩa này (Q4). Ở `mode: shared`, domain Backoffice PHẢI bắt buộc; thiếu thì chart dừng cài/nâng cấp và
  báo tên value và mục tài liệu. Domain Backoffice khai báo trong `values.yaml` (bắt buộc, có comment), ví dụ ở README;
  `values-separate-domain.yaml` bị xóa (Q5). Service API PHẢI chỉ chọn pod BE của release; value và nhãn đưa Directus vào
  pool bị bỏ (pod Directus còn nhãn cũ không nhận request). Chart KHÔNG sửa Deployment Directus, kể cả gỡ nhãn cũ (Q6).
  Kiểm thiếu domain chạy trước mọi kiểm tra khác, cả khi không đọc được cụm (FR-008).
- **FR-007**: Ingress của chart PHẢI chỉ phục vụ domain Backoffice. Thay "Ingress chung một domain" của FR-045 (019).
- **FR-008**: Kiểm tra cookie domain (FR-076 của 019) PHẢI chạy ở mọi lần cài/nâng cấp `mode: shared`; host so sánh là
  `ingress.host`, hoặc host của `domain.publicUrl` khi Ingress tắt. Kiểm tra env đa instance (FR-053) giữ nguyên. Như
  019, `helm template` và `--dry-run=client` không đọc được cụm nên bỏ qua hai kiểm tra này (chỉ kiểm thiếu domain,
  FR-006).

**Route riêng của 020 và 025**

- **FR-009**: Route riêng tới Backoffice trong lb và Ingress (020: `/extensions/sources/*`, FR-047, ghi chú D-137; 025:
  `/permissions/me`, `/backoffice/*`, D-189.7) PHẢI bỏ, vì pool chỉ có replica BE. Các path này vẫn do BE trả ở domain B.

**SAML, standalone**

- **FR-010**: Tài liệu và values PHẢI bỏ ví dụ định tuyến SAML về Directus trên Ingress Backoffice (FR-052 của 019) và ghi:
  user SAML chỉ dùng Directus app ở domain Directus, không dùng được Backoffice app (Q1). Value `extraPaths` giữ cho
  Service khác trong namespace; ví dụ và kiểm template không trỏ Directus (trỏ Directus từ domain B trái FR-001).
- **FR-011**: Chế độ standalone (021: compose override, Helm `mode: standalone`, Job bootstrap) PHẢI không đổi hành vi;
  file override có thể sửa để giữ hành vi (đặt lại `PUBLIC_URL` về `.env`, không mở cổng 8091); `domain.publicUrl` ở
  `standalone` vẫn bị bỏ qua như 021 FR-083.

**Test, CI, tài liệu**

- **FR-012**: Bộ test deploy PHẢI chạy trên bố cục FR-001 mặc định: US3–US6 của 019 (BE 3 replica cộng 1 Directus, gọi
  thẳng từng instance; tải và tắt replica qua lb domain B), kịch bản US9 của 019 (trừ SSO), test extensions và
  backoffice-permissions của 020/025, US1–US2 của 026. Job CI `deploy` bỏ lượt `separate-domain` riêng (còn lượt mặc
  định và standalone). Job `deploy-k8s` cài chart cạnh Directus không nhãn pool và kiểm US2 và US3 kịch bản 1; US3 kịch
  bản 2, 3 kiểm tay theo tài liệu.
- **FR-013**: `deploy/README.md` PHẢI: bỏ mô tả chung domain; mục "Domain riêng" thành bố cục mặc định; mục "Thay image
  Directus bằng Backoffice" ghi service đã đổi image phục vụ domain Backoffice và đặt riêng `PUBLIC_URL` (Q7); thêm mục
  chuyển từ chung domain sang domain riêng, theo thứ tự: DNS cho domain B; cookie FR-076 và SSO allow list trong env
  Directus; `helm upgrade` với `ingress.host`, `domain.publicUrl` (Ingress của chart rời host D; replica BE khởi động lại
  cuốn chiếu vì bỏ nhãn pod; theo `maxUnavailable: 0` của 019 FR-033 không mất request, chưa đo khi nâng cấp từ 019:
  tài liệu ghi rõ là suy luận); ngay sau đó thêm host D vào Ingress của Directus (domain D
  không có Ingress trong khoảng giữa hai bước; không để hai Ingress cùng host); kiểm hai domain; user đăng nhập lại ở
  domain B, user SAML không còn dùng Backoffice (FR-010); lùi lại khi cần: `helm rollback` rồi trả host D về Ingress
  cũ; gỡ tay nhãn pool trên Directus (Q6) sau cùng, khi đã chắc không lùi. Mục "Chạy cạnh Directus" ghi `PUBLIC_URL`
  khác nhau giữa hai app: link trong thông báo, `Location` TUS, callback SSO mang domain của app ghi.
- **FR-014**: Spec 019 PHẢI có ghi chú "revised by 026" ở đầu; spec 020 (D-137, FR-047) và 025 (D-189.7) PHẢI có ghi chú
  trỏ về 026. Mỗi dòng "Gỡ" hoặc "Sửa chữ" của bảng rà soát (FR-015) PHẢI có ghi chú ngắn "(026: ...)" ngay tại chỗ trong
  spec gốc; không viết lại nội dung cũ.

**Rà soát các spec trước**

- **FR-015**: Mọi chỗ trong spec 001–025 và code (`apps/api`, `apps/web`, `libs`, `deploy`, `tests`) lệch luồng Directus,
  hoặc thêm định tuyến hay xử lý chỉ vì hai app chung domain, chung pool, PHẢI nằm trong bảng "Rà soát chỗ lệch luồng
  Directus vì chung domain", với một trong ba cách xử lý: gỡ để về luồng Directus, sửa chữ, hoặc giữ kèm lý do.
  `/speckit.plan` PHẢI xác nhận bảng trong `research.md` bằng một lượt quét đủ: mọi bảng "Khác biệt so với Directus"
  (D-xx), Edge Cases, Clarifications, Assumptions của 001–025, cùng comment và nhánh code xử lý "API là Directus". Dòng
  thiếu PHẢI được thêm vào bảng. Dòng "Gỡ" chạm `apps/api` hoặc `apps/web` PHẢI được chủ dự án duyệt trước khi làm và PHẢI
  có parity hoặc E2E như feature gốc.

### Key Entities

- **Domain Directus (D)**: Directus app ở `/admin` và API của Directus; không đổi.
- **Domain Backoffice (B)**: FE ở `/admin`, pool API chỉ gồm replica BE; `PUBLIC_URL` của bản Backoffice.
- **Bộ cấu hình dùng chung**: `.env`, ConfigMap, Secret của Directus; bản Backoffice chỉ đặt riêng `PUBLIC_URL`.

## Khác biệt so với Directus *(mandatory)*

Không có khác biệt mới (thay đổi chỉ ở đóng gói triển khai, API và app không đổi).

| ID | Hạng mục | Thay đổi ở 026 |
|----|----------|----------------|
| D-189.7 (025) | Lb chung domain và Ingress gửi `/permissions/me`, `/backoffice/` tới Backoffice | Gỡ (FR-009) |
| D-137 (020) | Ghi chú "ở chế độ chung domain chỉ replica Backoffice trả các chunk này" | Ghi chú bỏ; nội dung khác biệt của chunk giữ nguyên |

**Cần xác nhận**: Không có.

## Clarifications

### Session 2026-10-28

- Q1: User SAML (Backoffice không có SAML, D-24 của 003) xử lý thế nào khi tách domain? → A: chỉ dùng Directus app ở
  domain Directus; tài liệu ghi rõ (FR-010, edge case "User SAML").
- Q2: Nguyên tắc VII ("BE ... sau load balancer, cùng với các instance Directus") và VIII ("không cần khai báo lại"; 019
  có ngoại lệ T079 cho `PUBLIC_URL`) sửa ở đâu? → A: sửa hiến pháp lên 3.3.0 bằng `/speckit.constitution`: VII chạy cạnh
  Directus thì ở domain riêng, pool API của Backoffice chỉ gồm replica BE; VIII `PUBLIC_URL` là biến duy nhất bản
  Backoffice đặt riêng khi chạy cạnh Directus. Ngoại lệ T079 của 019 thành quy tắc, không cần Complexity Tracking.
- Q3: Cổng của compose dev? → A: Directus `http://localhost:8090` qua lb (Directus app ở `/admin`), Backoffice
  `http://localhost:8091`, Directus gọi thẳng ở `8095`; env chung giữ `PUBLIC_URL=http://localhost:8090` (FR-005).
- Q4: Tên value Helm `mode: shared`? → A: giữ `shared` (nghĩa "chạy cạnh Directus, chung DB"); `values.yaml` và README
  ghi rõ nghĩa (FR-006).
- Q5: `values-separate-domain.yaml` gộp hay giữ? → A: xóa; domain Backoffice khai báo (bắt buộc, có comment) trong
  `values.yaml`, ví dụ ở README (FR-006).
- Q6: `helm upgrade` release chung domain cũ làm gì với nhãn pool trên Directus? → A: chỉ dừng và báo khi thiếu domain;
  chart không đụng Deployment Directus (nhãn cũ vô hại); tài liệu có bước tay gỡ nhãn (FR-006, FR-013).
- Q7: US1 của 019 (thay image một service Directus) còn hỗ trợ không? → A: giữ như hợp đồng của image (test
  `image-swap` giữ); service đã đổi image phục vụ domain Backoffice, đặt riêng `PUBLIC_URL`, không ở trong pool của
  domain Directus; SC-004 của 019 thành "chỉ image và `PUBLIC_URL`" (FR-013, edge case "Thay image").

## Assumptions

- Làm trên `main`, không tạo branch (quy ước của dự án, 012–025).
- Docker Compose ≥ 2.24.4 (`!override`, `!reset`), điều kiện 021 đã đặt cho override standalone.
- Override `shared-extensions` (020) không đụng `lb` hay `PUBLIC_URL`: không kịch bản riêng; `docker compose config` với
  override này hợp lệ là đủ.
- Standalone giữ Backoffice ở `8090` (không có Directus); cùng cổng 8090 là Directus ở compose mặc định (Q3).
- Test `image-swap.test.ts` (US1 của 019) gọi thẳng container, không dùng pool của lb, nên không đổi (Q7).
- `deploy/compose/docker-compose.eticket.yml` (compose của dịch vụ eticketing) đã đặt `PUBLIC_URL` riêng cho
  `backoffice-api`, `backoffice-web` và không có lb chung; định tuyến do gateway ngoài repo, tôi không kiểm được. File
  này không đổi.
- `benchmark.yml` không dùng `deploy/compose`, nên không đổi.
- Môi trường parity (`tests/parity/docker-compose.yml`) và ba cấu hình E2E web (proxy tới Directus, proxy tới API mới,
  cross-site) là môi trường test, không phải đóng gói triển khai: không đổi.
- Tôi không xác minh được có môi trường thật nào đang chạy chung domain; US3 và FR-013 cho trường hợp có.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 cấu hình trong repo (compose, lb, values, template Helm, values và kịch bản kind, job CI, ví dụ tài liệu)
  đặt Directus và Backoffice chung một domain hoặc đưa Directus vào pool API của Backoffice; ngoại lệ duy nhất là bước
  giả lập "pod còn nhãn cũ" của US2 kịch bản 3 trong kịch bản kind.
- **SC-002**: Bộ test deploy (US3–US6, US9 trừ SSO của 019; US1–US2 của 026) đạt 100% trên compose mặc định; job CI
  `deploy` chạy 2 lượt (mặc định, standalone) thay vì 3.
- **SC-003**: Dưới tải liên tục qua domain Backoffice: 0 request tới Directus (compose: log upstream của lb; kind:
  endpoints của Service API); tắt một replica BE: 0 request lỗi (SC-002 của 019 giữ).
- **SC-004**: Cài chart cạnh Directus: đúng 1 biến đặt riêng (`PUBLIC_URL`: mục `env` của pod BE và FE ngoài `envFrom`
  chỉ có biến này); 0 thay đổi trên Deployment, Service, Ingress của Directus (`metadata.generation` và
  `resourceVersion` trước và sau khi cài bằng nhau).
- **SC-005**: Từ máy chỉ có Docker, một lệnh dựng compose dev và đăng nhập được ở cả `D/admin` và `B/admin` trong dưới 10
  phút khi đã có image (SC-007 của 019).
- **SC-006**: `helm upgrade` release chung domain cũ không có domain Backoffice: 100% dừng trước khi đổi tài nguyên, thông
  báo nêu value cần đặt.
- **SC-007**: Sau 026, mọi kết quả tìm "chung domain", "shared-domain", "rơi vào Directus" trong spec 001–025 nằm ở 019
  (đã có ghi chú đầu) hoặc có ghi chú "(026: ...)" ngay tại chỗ; `research.md` liệt kê 100% dòng của bảng rà soát kèm
  cách xử lý.
