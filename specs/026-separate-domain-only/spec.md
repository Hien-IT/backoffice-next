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
  `/backoffice/`, `ci/deps.yaml` của kind đưa Directus vào pool.
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
| 020 FR-047, ghi chú của D-137 | Ở chế độ chung domain chỉ replica Backoffice trả `/extensions/sources/*` (route riêng) | FR-009: không cần route riêng |
| 025 D-189.7 | Lb chung domain và Ingress gửi `/permissions/me`, `/backoffice/` tới Backoffice | FR-009: gỡ D-189.7 |

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
2. **Given** hệ thống đang chạy, **When** gọi API ở domain B (đọc, ghi, upload TUS), **Then** mọi request tới replica BE,
   0 request tới Directus; `Location` của TUS nằm ở domain B.
3. **Given** cùng file env cho Directus và BE, **When** so env của hai service, **Then** chỉ khác `PUBLIC_URL`.
4. **Given** cần 3 replica, **When** chạy lệnh khởi động với số replica 3, **Then** hệ thống chạy BE 3 replica cộng 1
   Directus, không sửa file; từng instance gọi thẳng được (FR-044 của 019).
5. **Given** override standalone (021), **When** chạy như trước, **Then** hành vi không đổi (Backoffice một mình).

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
   request tới pod Directus đó.
4. **Given** ConfigMap/Secret chung có `REFRESH_TOKEN_COOKIE_DOMAIN` hoặc `SESSION_COOKIE_DOMAIN` không phủ host B,
   **When** cài hoặc nâng cấp, **Then** chart dừng và báo như FR-076 của 019.
5. **Given** `mode: standalone` (021), **When** cài như trước, **Then** hành vi không đổi.

---

### User Story 3 - Chuyển một bản đang chạy chung domain sang domain riêng (Priority: P2)

Đội vận hành có bản cài theo chế độ chung domain của 019 (Directus trong pool, Ingress của chart giữ domain Directus).
Họ làm theo tài liệu để chuyển Backoffice sang domain riêng và trả domain cũ về Directus.

**Why this priority**: Chỉ cần khi đã có bản chung domain; tôi không xác minh được có môi trường nào như vậy.

**Independent Test**: Trên kind: cài chart bản cũ (chung domain, Directus có nhãn pool), làm theo mục chuyển đổi của
tài liệu, nâng cấp chart; kiểm domain D chỉ tới Directus, domain B chỉ tới Backoffice, dữ liệu giữ nguyên.

**Acceptance Scenarios**:

1. **Given** release chung domain cũ, **When** `helm upgrade` với values cũ (không domain Backoffice), **Then** chart
   dừng, không đổi tài nguyên nào, thông báo nêu value cần đặt và mục chuyển đổi.
2. **Given** làm đủ các bước của tài liệu, **When** nâng cấp xong, **Then** domain D do Directus phục vụ toàn bộ (gồm
   `/admin` của Directus), domain B do Backoffice phục vụ; không mất dữ liệu.
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
  thay image chạy ở domain B, không ở trong pool của domain D.
- **Pod Directus còn nhãn pool cũ** sau khi chuyển: không nhận request của domain B (US2 kịch bản 3).

### Truy vết user story và requirement

| User story | Requirement |
|------------|-------------|
| US1 | FR-001..FR-005, FR-009, FR-011, FR-012 |
| US2 | FR-001..FR-004, FR-006..FR-009, FR-011, FR-012 |
| US3 | FR-006, FR-013 |

## Requirements *(mandatory)*

### Functional Requirements

**Bố cục khi chạy cạnh Directus**

- **FR-001**: Khi Backoffice chạy cạnh Directus (compose mặc định, chart `mode: shared`), Backoffice PHẢI ở domain riêng.
  Repo KHÔNG còn cấu hình nào (compose, lb, values, template, ví dụ trong tài liệu) đặt hai app chung một domain hoặc đưa
  Directus vào pool API của Backoffice. Thay FR-050 (phần pool), Q1, câu cuối FR-070 của 019.
- **FR-002**: Ở domain Backoffice: `/admin` và `/admin/*` vào FE; mọi path khác (cả `/`) vào pool chỉ gồm replica BE.
  Giữ FR-051 của 019 (body, timeout, header chuyển tiếp) và FR-035 (lỗi kết nối chuyển replica khác).
- **FR-003**: Bản Backoffice PHẢI dùng nguyên env chung và chỉ đặt riêng `PUBLIC_URL` (FR-071 của 019 thành quy tắc chung);
  FE gọi API ở chính domain của nó (FR-072). Thay phần "chế độ domain riêng" của FR-046 và bảng env của 019.
- **FR-004**: Directus PHẢI giữ domain, Directus app ở `/admin`, Deployment, Service, Ingress của nó; compose và chart
  KHÔNG định tuyến request nào của domain Directus tới Backoffice.

**Compose**

- **FR-005**: Lệnh khởi động mặc định của `deploy/compose` (không file override) PHẢI dựng bố cục FR-001: Directus ở một
  cổng (domain D), Backoffice ở cổng khác (domain B), từng instance gọi thẳng được (FR-044 của 019), số replica đổi lúc
  chạy (FR-043). Override domain riêng gộp vào mặc định và không còn là file riêng. Override standalone (021) và
  shared-extensions (020) vẫn chạy.

**Helm chart**

- **FR-006**: Ở `mode: shared`, domain Backoffice PHẢI bắt buộc; thiếu thì chart dừng cài/nâng cấp và báo tên value và
  mục tài liệu. Service API PHẢI chỉ chọn pod BE của release; value và nhãn đưa Directus vào pool bị bỏ (pod Directus còn
  nhãn cũ không nhận request).
- **FR-007**: Ingress của chart PHẢI chỉ phục vụ domain Backoffice. Thay "Ingress chung một domain" của FR-045 (019).
- **FR-008**: Kiểm tra cookie domain (FR-076 của 019) PHẢI chạy ở mọi lần cài/nâng cấp `mode: shared`. Kiểm tra env đa
  instance (FR-053) giữ nguyên.

**Route riêng của 020 và 025**

- **FR-009**: Route riêng tới Backoffice trong lb và Ingress (020: `/extensions/sources/*`, FR-047, ghi chú D-137; 025:
  `/permissions/me`, `/backoffice/*`, D-189.7) PHẢI bỏ, vì pool chỉ có replica BE. Các path này vẫn do BE trả ở domain B.

**SAML, standalone**

- **FR-010**: Tài liệu và values PHẢI bỏ ví dụ định tuyến SAML về Directus trên Ingress Backoffice (FR-052 của 019) và ghi:
  user SAML chỉ dùng Directus app ở domain Directus, không dùng được Backoffice app (Q1).
- **FR-011**: Chế độ standalone (021: compose override, Helm `mode: standalone`, Job bootstrap) PHẢI không đổi hành vi.

**Test, CI, tài liệu**

- **FR-012**: Bộ test deploy PHẢI chạy trên bố cục FR-001 mặc định: US3–US6 của 019 (BE 3 replica cộng 1 Directus, gọi
  thẳng từng instance; tải và tắt replica qua lb domain B), kịch bản US9 của 019 (trừ SSO), test extensions và
  backoffice-permissions của 020/025, US1–US2 của 026. Job CI `deploy` bỏ lượt `separate-domain` riêng (còn lượt mặc
  định và standalone). Job `deploy-k8s` cài chart cạnh Directus không nhãn pool và kiểm US2.
- **FR-013**: `deploy/README.md` PHẢI: bỏ mô tả chung domain; mục "Domain riêng" thành bố cục mặc định; thêm mục chuyển từ
  chung domain sang domain riêng (DNS, Ingress của Directus lấy lại domain D, bỏ nhãn pool trên Directus, đặt domain và
  `PUBLIC_URL` cho Backoffice, cookie FR-076, SSO allow list, user đăng nhập lại).
- **FR-014**: Spec 019 PHẢI có ghi chú "revised by 026" ở đầu; spec 020 (D-137, FR-047) và 025 (D-189.7) PHẢI có ghi chú
  trỏ về 026.

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

## Assumptions

- Làm trên `main`, không tạo branch (quy ước của dự án, 012–025).
- `mode: shared` của chart (021) nghĩa là "chạy cạnh Directus, chung DB", không phải "chung domain"; giữ tên value để
  values đang dùng không vỡ.
- Compose dev giữ cổng đã test của chế độ domain riêng: Directus `http://localhost:8090` (Directus app ở `/admin`),
  Backoffice `http://localhost:8091`, Directus gọi thẳng ở `8095`; standalone giữ Backoffice ở `8090`.
- US1 của 019 (thay image Directus) giữ như hợp đồng của image (env, volume, probe, uid, tini); test thay image không
  dùng pool của lb nên không đổi.
- `benchmark.yml` không dùng `deploy/compose`, nên không đổi.
- Môi trường parity (`tests/parity/docker-compose.yml`) và ba cấu hình E2E web (proxy tới Directus, proxy tới API mới,
  cross-site) là môi trường test, không phải đóng gói triển khai: không đổi.
- Tôi không xác minh được có môi trường thật nào đang chạy chung domain; US3 và FR-013 cho trường hợp có.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 0 cấu hình trong repo (compose, lb, values, template Helm, ví dụ tài liệu) đặt Directus và Backoffice chung
  một domain hoặc đưa Directus vào pool API của Backoffice.
- **SC-002**: Bộ test deploy (US3–US6, US9 của 019; US1–US2 của 026) đạt 100% trên compose mặc định; job CI `deploy` chạy
  2 lượt (mặc định, standalone) thay vì 3.
- **SC-003**: Dưới tải liên tục qua domain Backoffice: 0 request tới Directus; tắt một replica BE: 0 request lỗi (SC-002
  của 019 giữ).
- **SC-004**: Cài chart cạnh Directus: đúng 1 biến đặt riêng (`PUBLIC_URL`); 0 thay đổi trên Deployment, Service, Ingress
  của Directus.
- **SC-005**: Từ máy chỉ có Docker, một lệnh dựng compose dev và đăng nhập được ở cả `D/admin` và `B/admin` trong dưới 10
  phút khi đã có image (SC-007 của 019).
- **SC-006**: `helm upgrade` release chung domain cũ không có domain Backoffice: 100% dừng trước khi đổi tài nguyên, thông
  báo nêu value cần đặt.
