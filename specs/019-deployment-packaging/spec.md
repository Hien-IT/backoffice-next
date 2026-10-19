# Feature Specification: Đóng gói triển khai (image FE và BE, nhiều replica sau load balancer, docker-compose dev, Helm chart)

**Feature Branch**: `019-deployment-packaging` (làm trên `main` như 012–018, không tạo branch; `specs/019-*` là thư mục
feature hiện tại theo quy tắc "thư mục số cao nhất" của `.specify/scripts/bash/common.sh`)
**Created**: 2026-10-20
**Status**: Draft
**Input**: User description: "Đóng gói app mới để triển khai: FE chạy 1 container, BE chạy nhiều container sau load
balancer, cùng DB và Redis với Directus. FE: image nginx phục vụ file tĩnh ở /admin, đọc URL API và cấu hình từ biến môi
trường lúc container khởi động, fallback về index.html cho route của SPA. BE: image chạy được với số replica tùy ý, không
cần sticky session, có readiness và liveness probe qua /server/health, tắt máy an toàn khi nhận SIGTERM (ngừng nhận
request, chạy nốt request đang dở, đóng kết nối DB và Redis). Định tuyến chung một domain: /admin/* vào FE, các path còn
lại vào BE. Cung cấp docker-compose cho máy dev (Directus 11.17.4, BE 2 replica, FE, Postgres, Redis, MinIO làm S3) và
manifest Kubernetes hoặc Helm chart cho môi trường thật (Deployment, Service, Ingress, HPA cho BE, dùng lại nguyên
ConfigMap và Secret đang cấp cho Directus, không khai báo lại biến). Thay một instance Directus bằng BE mới chỉ cần đổi
image, giữ nguyên toàn bộ biến môi trường. Tiêu chí chấp nhận: với BE 3 replica cộng 1 Directus, các bài test sau đều
đạt: đăng nhập rồi gọi API lần lượt vào từng replica; sửa schema ở một replica thì replica khác thấy ngay; flow theo lịch
chỉ chạy một lần mỗi lượt; upload TUS nhiều chunk qua các replica khác nhau vẫn thành công; tắt một replica khi đang tải
không làm lỗi request."

**Đã có từ các feature trước** (khảo sát 2026-10-20; 019 hoàn thiện, không làm lại):

- `apps/api/Dockerfile`: image theo `directus/Dockerfile` (R20 của 001), một process `node dist/main.js`, không
  `bootstrap`, không PM2 (D-19 của 001), `WORKDIR /directus`, cổng 8055, user `node`.
- `apps/web/Dockerfile`, `apps/web/nginx.conf`, `apps/web/docker/40-config.sh`: nginx-unprivileged (uid 101, cổng 8080)
  phục vụ build ở `/admin`, `/` → `302 /admin/`, `config.json` sinh từ `PUBLIC_URL` lúc khởi động (`no-store`), SPA
  fallback về `/admin/index.html`, MIME `.mjs` cho worker maplibre. Plan 001 ghi "hoàn thiện ở 019".
- `apps/api/src/server.ts`, `shutdown.ts`: trình tự tắt máy của Directus (terminus, FR-080 của 001): `/server/health`
  chuyển `error`, ngừng nhận kết nối, chờ request dở tối đa `SERVER_SHUTDOWN_TIMEOUT`, đóng DB, rồi Redis và job.
- `apps/api/src/config/warn-single-instance.ts`: cảnh báo khi cấu hình chỉ an toàn cho một instance (thiếu Redis,
  `CACHE_STORE=memory`, `RATE_LIMITER_STORE=memory`).
- Cache schema, permission, response, bus, lock flow theo lịch, khóa và dữ liệu dở của TUS đã dùng chung Redis với
  Directus (002, 004, 005, 007, 009); 007 đã kiểm TUS xen kẽ chunk giữa Directus và app mới.
- `dev/directus-reference/docker-compose.yml` (Directus 11.17.4, Postgres PostGIS, Redis, MinIO) và
  `tests/parity/docker-compose.yml` (proxy nginx, nhiều profile).

**Việc các spec trước chuyển sang 019**:

| Nguồn | Nội dung | Xử lý ở 019 |
|-------|----------|-------------|
| 007 spec Assumptions, plan dòng "TUS qua nhiều replica" | TUS qua nhiều replica của riêng app mới | FR-061, US5 |
| 003 spec Assumptions (D-24) | Tài liệu triển khai ghi: hệ thống có user SAML định tuyến `/auth/*` của họ về Directus | FR-052 |
| 012 spec, ghi chú bảo mật CHK077–079 | CSP là việc của triển khai | FR-005 |
| 001 plan cây thư mục | Dockerfile FE "hoàn thiện ở 019" | FR-001..FR-006 |
| 001 FR-112, `.github/workflows/nightly.yml` | Lịch nightly tắt "tới khi xong mọi chức năng" | Ngoài phạm vi 019; xem Assumptions |

## User Scenarios & Testing *(mandatory)*

Người dùng chính của feature này là đội vận hành: người dựng môi trường dev, người deploy lên Kubernetes, người thay dần
Directus bằng app mới. Người dùng cuối của app chỉ thấy kết quả: app không lỗi khi hệ thống co giãn hoặc cập nhật.

### User Story 1 - Thay một instance Directus bằng BE mới chỉ bằng cách đổi image (Priority: P1)

Đội vận hành có một Directus 11.17.4 đang chạy (compose hoặc Kubernetes) với `.env`, ConfigMap, Secret, volume và probe
riêng. Họ đổi image của một instance sang image BE mới, không sửa gì khác. Instance mới chạy ngang hàng với các instance
Directus còn lại trên cùng DB, Redis và storage.

**Why this priority**: Đây là con đường chuyển đổi chính. Nếu phải khai báo lại biến, đổi volume hay probe thì mỗi môi
trường cần một bộ cấu hình riêng, trái Nguyên tắc VIII.

**Independent Test**: Lấy compose Directus có sẵn, đổi một dòng `image:`, khởi động; gọi `/server/health`, đăng nhập,
đọc item, upload file qua instance mới; so sánh với Directus.

**Acceptance Scenarios**:

1. **Given** một service Directus 11.17.4 với env, volume `/directus/uploads`, `/directus/database`,
   `/directus/extensions` và probe `/server/health`, **When** chỉ đổi image sang BE mới, **Then** instance khởi động,
   probe đạt, API trả như Directus (theo các spec 001–011), không có biến nào phải thêm, đổi tên hay xóa.
2. **Given** env có biến chỉ Directus dùng (`PM2_INSTANCES`, `SERVE_APP`, biến extension, websocket),
   **When** BE khởi động, **Then** BE chỉ ghi cảnh báo như 001 (FR về biến chưa hỗ trợ, D-08), không dừng.
3. **Given** file trên volume local do Directus ghi, **When** BE đọc, ghi, xóa file đó, **Then** không lỗi quyền: hai
   image chạy cùng uid/gid.
4. **Given** DB mới chưa có bảng hệ thống, **When** chỉ chạy BE (không có Directus nào), **Then** BE dừng và báo thiếu
   migration như 001; tài liệu ghi phải chạy `directus bootstrap` (image Directus) một lần trước.
5. **Given** container BE đang chạy, **When** xem tiến trình, **Then** PID 1 là init, Node là tiến trình con chạy bằng
   uid 1000; một tiến trình con mồ côi đã thoát được dọn trong vòng 1 giây (không còn trạng thái zombie); SIGTERM làm
   container thoát mã 143 sau trình tự tắt máy của 001 (FR-025, FR-026).

---

### User Story 2 - Docker-compose cho máy dev: một lệnh dựng đủ hệ thống nhiều replica (Priority: P1)

Lập trình viên chạy một lệnh và có: Directus 11.17.4, BE 2 replica, FE, Postgres, Redis, MinIO làm S3, một load
balancer trên một cổng. Mở trình duyệt vào `http://localhost:<cổng>/admin`, đăng nhập, dùng app; mọi request API đi qua
load balancer xoay vòng giữa các replica.

**Why this priority**: Đây là môi trường chạy các bài test chấp nhận (US3–US6) và môi trường dev hằng ngày.

**Independent Test**: `docker compose up` trên máy sạch (chỉ có Docker), chờ mọi service healthy, đăng nhập qua
`/admin`, xem log thấy request rơi vào cả hai replica BE.

**Acceptance Scenarios**:

1. **Given** máy chỉ có Docker và file `.env` mẫu (secret sinh ngẫu nhiên như `dev/directus-reference`), **When** chạy
   lệnh khởi động, **Then** mọi service healthy; Directus khởi tạo DB một lần, các replica BE chỉ khởi động sau đó.
2. **Given** hệ thống đang chạy, **When** mở `/admin/content` rồi tải lại trang, **Then** app hiện đúng trang (SPA
   fallback); `/admin/config.json` chứa URL API của môi trường.
3. **Given** cùng một file env cho Directus và BE, **When** so env của hai service, **Then** giống hệt nhau (chỉ khác
   image).
4. **Given** cần 3 replica cho test chấp nhận, **When** chạy lệnh khởi động với số replica 3, **Then** hệ thống chạy
   BE 3 replica cộng 1 Directus mà không sửa file compose.

---

### User Story 3 - Đăng nhập một lần, gọi API lần lượt vào từng replica (Priority: P1)

User đăng nhập; các request tiếp theo rơi vào replica bất kỳ (BE hoặc Directus) mà không mất phiên, không cần sticky
session.

**Why this priority**: Tiêu chí chấp nhận 1 của người yêu cầu; không đạt thì load balancer phải dùng sticky session.

**Independent Test**: Với BE 3 replica cộng 1 Directus, đăng nhập ở replica 1, gọi `/users/me` lần lượt trên cả 4
instance (gọi thẳng từng instance, không qua load balancer), refresh ở instance khác instance đăng nhập.

**Acceptance Scenarios**:

1. **Given** access token lấy từ một replica, **When** gọi `/users/me` và `/items/<collection>` lần lượt trên từng
   instance, **Then** cả 4 trả `200` cùng dữ liệu.
2. **Given** phiên dạng cookie (`mode: session`) và dạng refresh token (`mode: json`, `cookie`), **When** refresh ở
   replica khác replica đăng nhập, rồi logout ở replica thứ ba, **Then** refresh đạt; sau logout, token cũ bị từ chối ở
   mọi instance.
3. **Given** đăng nhập sai liên tiếp phân tán qua các instance, **When** vượt ngưỡng khóa tài khoản
   (`AUTH_LOGIN_ATTEMPTS`), **Then** tài khoản bị khóa giống như khi chỉ có một instance (bộ đếm dùng chung).

---

### User Story 4 - Sửa schema ở một replica, replica khác thấy ngay (Priority: P1)

Admin tạo collection, thêm field, sửa quyền ở một instance; request ngay sau đó tới instance khác đã thấy thay đổi.

**Why this priority**: Tiêu chí chấp nhận 2; schema lệch giữa replica làm lỗi dữ liệu.

**Independent Test**: Với BE 3 replica cộng 1 Directus, `POST /fields` ở instance A; ngay khi response trả về, đọc item
có field mới ở B, C, D.

**Acceptance Scenarios**:

1. **Given** schema đã được cache trên mọi instance, **When** tạo field ở instance A rồi đọc field đó ở B, C, D ngay
   sau response của A, **Then** cả ba trả field mới, không phải chờ TTL cache.
2. **Given** permission của một policy được sửa ở Directus, **When** user thuộc policy đó gọi BE replica, **Then**
   quyền mới có hiệu lực ngay ở request tiếp theo.
3. **Given** response cache bật (`CACHE_ENABLED`), **When** sửa item ở A, **Then** đọc ở B không trả bản cũ (như hành vi
   xóa cache của Directus).

---

### User Story 5 - Flow theo lịch chạy đúng một lần mỗi lượt; TUS nhiều chunk qua nhiều replica (Priority: P1)

Flow trigger `schedule` chạy đúng một lần mỗi lượt dù có 4 instance. Upload TUS nhiều chunk thành công khi mỗi chunk
rơi vào một instance khác nhau.

**Why this priority**: Tiêu chí chấp nhận 3 và 4; chạy trùng làm sai dữ liệu, TUS hỏng làm mất upload lớn.

**Independent Test**: Flow `schedule` mỗi lượt ghi một dòng log; sau N lượt đếm số lượt chạy. Upload một file nhiều
chunk, gửi chunk k tới instance k mod 4.

**Acceptance Scenarios**:

1. **Given** flow trigger `schedule` mỗi phút (cron), BE 3 replica cộng 1 Directus, **When** chạy qua 10 lượt, **Then**
   có đúng 10 lần chạy trong `directus_activity`/log của flow, không lượt nào trùng hoặc thiếu.
2. **Given** một instance đang giữ lượt bị tắt, **When** tới lượt kế tiếp, **Then** instance khác chạy lượt đó.
3. **Given** `TUS_ENABLED=true`, file lớn hơn 4 lần `TUS_CHUNK_SIZE`, storage S3 (MinIO), **When** tạo upload ở A, gửi
   từng chunk xoay vòng A, B, C, D (có Directus), **Then** upload hoàn tất, file trên storage giống byte với file gốc, có
   đúng một dòng `directus_files`.
4. **Given** upload TUS dở, **When** instance đang nhận chunk bị tắt, **Then** client tiếp tục từ offset hiện tại ở
   instance khác và hoàn tất.

---

### User Story 6 - Tắt hoặc thêm replica khi đang có tải không làm lỗi request (Priority: P1)

Hệ thống đang có tải qua load balancer. Một replica BE bị tắt (SIGTERM: scale down, rolling update, node drain) hoặc
một replica mới được thêm. Không request nào của client lỗi.

**Why this priority**: Tiêu chí chấp nhận 5; HPA và rolling update làm việc này nhiều lần mỗi ngày.

**Independent Test**: Chạy tải liên tục qua load balancer (đọc và ghi), gửi SIGTERM tới một replica, đếm request lỗi;
rồi thêm một replica và đếm lại.

**Acceptance Scenarios**:

1. **Given** tải liên tục qua load balancer với các request ngắn hơn `SERVER_SHUTDOWN_TIMEOUT`, **When** một replica BE
   nhận SIGTERM, **Then** không request nào trả lỗi kết nối hoặc 5xx; replica thoát với mã 143 trong thời hạn tắt máy.
2. **Given** replica nhận SIGTERM, **When** đang có request dở, **Then** request đó chạy xong; sau đó kết nối DB và
   Redis của replica đó được đóng (số kết nối phía server giảm tương ứng).
3. **Given** một replica mới khởi động, **When** chưa sẵn sàng (chưa kết nối DB, Redis, chưa kiểm migration), **Then**
   load balancer chưa gửi request tới nó; khi sẵn sàng thì nhận request mà không lỗi.
4. **Given** Kubernetes rolling update toàn bộ BE dưới tải, **When** rollout xong, **Then** không request nào lỗi.

---

### User Story 7 - Helm chart cho môi trường thật dùng lại ConfigMap và Secret của Directus (Priority: P2)

Đội vận hành cài chart vào namespace đang có Directus. Họ chỉ khai báo tên ConfigMap và Secret của Directus, image, số
replica, domain. Chart tạo Deployment, Service cho FE và BE, Ingress chung một domain, HPA cho BE.

**Why this priority**: Môi trường thật; phụ thuộc US1 (image) và đã kiểm hành vi đa replica ở US3–US6 trên compose.

**Independent Test**: Cài chart vào một cụm Kubernetes thử (cụm cục bộ trong CI) có sẵn ConfigMap/Secret mẫu kiểu
Directus; probe đạt; Ingress định tuyến đúng; rolling update dưới tải không lỗi.

**Acceptance Scenarios**:

1. **Given** ConfigMap và Secret đang cấp cho Directus, **When** cài chart chỉ với tên của chúng, **Then** pod BE nhận
   đúng toàn bộ biến đó; chart không chứa biến môi trường nào của Directus.
2. **Given** chart đã cài, **When** gọi `https://<domain>/admin/...` và `https://<domain>/items/...`, **Then** request
   thứ nhất tới FE, thứ hai tới BE.
3. **Given** HPA bật và cụm có metrics-server, **When** chart cài xong, **Then** HPA trỏ đúng Deployment BE, đọc được
   mức CPU hiện tại (không `<unknown>`), có `minReplicas`/`maxReplicas`/ngưỡng CPU đã khai báo; số replica đổi (tăng hoặc
   giảm) dưới tải không làm lỗi request (US6). Quyết định khi nào scale là việc của Kubernetes, không kiểm.
4. **Given** storage `local` trên volume dùng chung với Directus, **When** khai báo tên PVC đang dùng, **Then** pod BE
   mount cùng PVC ở `/directus/uploads`.

---

### User Story 8 - FE một image cho mọi môi trường (Priority: P2)

Cùng một image FE chạy ở dev, staging, production; mỗi môi trường chỉ khác biến lúc khởi động container.

**Why this priority**: Nguyên tắc VII; đã có phần lớn từ 012, 019 hoàn thiện cache, CSP, probe.

**Independent Test**: Chạy cùng image với hai `PUBLIC_URL` khác nhau; mỗi container gọi đúng API của mình.

**Acceptance Scenarios**:

1. **Given** cùng một image, **When** khởi động với `PUBLIC_URL` khác nhau, **Then** `/admin/config.json` khác nhau và
   app gọi đúng API.
2. **Given** bản FE mới được deploy, **When** user đang mở app tải lại trang, **Then** nhận bản mới (`index.html` không
   bị cache lâu); file tĩnh có hash trong tên được cache lâu.
3. **Given** các biến `CONTENT_SECURITY_POLICY_*` trong env chung, **When** tải `/admin`, **Then** header CSP giống
   header Directus trả cho `/admin` với cùng env.

---

### User Story 9 - Bản Backoffice ở domain riêng, chung DB, Redis, S3 với Directus (Priority: P2)

Đội vận hành giữ nguyên Directus ở domain của nó (ví dụ `cms.example.com`, vẫn phục vụ Directus app ở `/admin`) và
dựng thêm một bản Backoffice (FE + BE nhiều replica) ở domain khác (ví dụ `backoffice.example.com`). Hai bản dùng chung
DB, Redis, storage S3 và cùng ConfigMap/Secret; user dùng app nào cũng thấy cùng dữ liệu.

**Why this priority**: Cho phép chạy thử Backoffice song song với Directus đang phục vụ người dùng mà không chạm vào
domain, Ingress hay Deployment của Directus. Thêm vào ngày 2026-10-20 theo yêu cầu của chủ dự án.

**Independent Test**: Chạy compose (hoặc chart) ở chế độ domain riêng: Directus ở một cổng hoặc host, Backoffice ở
cổng hoặc host khác; đăng nhập, sửa dữ liệu, upload TUS trên Backoffice; đọc lại ở Directus và ngược lại.

**Acceptance Scenarios**:

1. **Given** Directus ở domain D và Backoffice ở domain B cùng ConfigMap/Secret, **When** cài bản Backoffice, **Then**
   chỉ `PUBLIC_URL` được đặt riêng cho bản B (FR-071); Deployment, Service, Ingress của Directus không đổi.
2. **Given** user đăng nhập ở `B/admin`, **When** dùng app, **Then** mọi request API đi tới các replica BE ở domain B
   (cùng origin, không cần CORS), không request nào tới domain D.
3. **Given** upload TUS bắt đầu ở domain B, **When** server trả `Location`, **Then** URL nằm ở domain B và upload hoàn
   tất qua các replica BE.
4. **Given** item hoặc schema sửa ở Directus (domain D), **When** đọc ở domain B ngay sau đó, **Then** thấy thay đổi
   (cache và bus dùng chung, như US4); chiều ngược lại cũng vậy.
5. **Given** link do bản B sinh (mời user, share, đặt lại mật khẩu, callback SSO), **When** mở link, **Then** link trỏ
   về domain B.
6. **Given** phiên đăng nhập ở domain D, **When** mở domain B, **Then** user phải đăng nhập lại (cookie theo domain);
   cả hai phiên cùng nằm trong `directus_sessions` và cùng hợp lệ.

---

### Edge Cases

- **Domain riêng, biến cookie có domain**: cấu hình chung đặt `REFRESH_TOKEN_COOKIE_DOMAIN` hoặc `SESSION_COOKIE_DOMAIN`
  (biến Directus, mặc định không đặt: `directus/api/src/constants.ts:66-80`) theo domain D thì trình duyệt bỏ cookie ở
  domain B. Bản B KHÔNG đặt riêng hai biến này; hệ thống báo để chủ dự án sửa env của Directus (bỏ biến, hoặc đặt domain
  cha phủ cả D và B) (FR-076).
- **Domain riêng với SSO**: IdP phải có callback của domain B; `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST` (và
  `AUTH_ALLOWED_PUBLIC_URLS` nếu dùng) trong cấu hình chung phải có URL của domain B. Đây là thêm giá trị vào biến đã có,
  không thêm biến mới.
- **Domain riêng với response cache dùng chung**: khóa cache của Directus không chứa host, nên response có URL theo host
  (`/server/specs/oas`) đã cache ở domain này có thể được trả ở domain kia, giống hai bản Directus khác domain dùng chung
  Redis. Ghi trong tài liệu, không sửa (Nguyên tắc III).

- **Cấu hình chỉ an toàn cho một instance** (thiếu Redis; `CACHE_STORE`, `RATE_LIMITER_STORE` là `memory`, đây là mặc
  định của Directus; `SYNCHRONIZATION_STORE` khác `redis`, mặc định Directus là bộ nhớ process,
  `directus/api/src/synchronization.ts:20`): flow theo lịch chạy trên mọi instance, cache và bộ đếm đăng nhập lệch giữa
  instance. BE vẫn khởi động như 001 (app không tự biết số replica). Compose đặt sẵn các biến này; chart dừng cài và báo
  để chủ dự án sửa env của Directus (FR-053). 001 chưa cảnh báo `SYNCHRONIZATION_STORE` (Assumptions).
- **Storage `local` không dùng chung**: mỗi replica thấy file khác nhau. Compose dùng MinIO (S3); chart chỉ cho mount
  PVC dùng chung (Nguyên tắc VII), tài liệu ghi PVC phải `ReadWriteMany`.
- **Request dài hơn `SERVER_SHUTDOWN_TIMEOUT`** (mặc định 1000 ms: export lớn, chunk TUS chậm, import): bị cắt khi
  tắt replica, giống Directus. Tài liệu ghi cách tăng `SERVER_SHUTDOWN_TIMEOUT` trong ConfigMap chung; thời hạn tắt máy
  của pod lớn hơn giá trị này. Client TUS tiếp tục được từ offset (US5 kịch bản 4).
- **Load balancer gửi request tới replica vừa nhận SIGTERM** (độ trễ cập nhật endpoint của Kubernetes): replica phải
  vẫn nhận request trong khoảng trễ này rồi mới ngừng nhận (FR-033).
- **Liveness khi DB hoặc Redis mất**: `/server/health` trả `503` (001) nên pod ra khỏi traffic; liveness dùng
  `/server/ping` nên pod không bị khởi động lại (FR-032).
- **Directus trong pool khi tắt máy**: Directus ngừng nhận kết nối ngay khi SIGTERM (D-122). Muốn không lỗi request khi
  tắt instance Directus trong pool, Deployment Directus cần cùng khoảng trễ trước khi tắt (cấu hình pod, không phải
  env); tài liệu ghi cách thêm. Compose chuyển lỗi kết nối sang instance khác (FR-035) nên không cần.
- **Nhiều replica khởi động cùng lúc trên DB mới**: BE không chạy migration, chỉ kiểm; replica dừng với lỗi migration
  tới khi Directus bootstrap xong (compose có thứ tự khởi động; Kubernetes khởi động lại pod).
- **Directus Deployment đang ghi đè `command`/`args`** (ví dụ gọi `npx directus bootstrap && pm2-runtime`): đổi image
  thôi không đủ; tài liệu ghi phải bỏ ghi đè đó. Đây là giới hạn duy nhất của "chỉ đổi image".
- **User SAML**: SAML không được port (D-24 của 003); Ingress cần định tuyến `/auth/login/<saml>` và
  `/auth/login/<saml>/acs` về Directus (FR-052).
- **`/websocket`**: đi vào BE, BE trả như Directus khi `WEBSOCKETS_ENABLED=false` (Nguyên tắc XI).
- **Upload lớn qua load balancer**: load balancer không giới hạn kích thước body thấp hơn `FILES_MAX_UPLOAD_SIZE` và
  không đệm toàn bộ body (FR-051).
- **`PUBLIC_URL` có path con** (ví dụ `https://example.com/cms`): ngoài phạm vi; giữ bố cục Directus ở gốc domain
  (Assumptions).

### Truy vết user story và requirement

| User story | Requirement |
|------------|-------------|
| US1 | FR-020..FR-026 |
| US2 | FR-040..FR-044 |
| US3, US4, US5 | FR-030, FR-060..FR-063 |
| US6 | FR-031..FR-035, FR-064 |
| US7 | FR-045..FR-049, FR-050..FR-053 |
| US8 | FR-001..FR-006 |
| US9 | FR-070..FR-076 |

## Requirements *(mandatory)*

### Functional Requirements

**Image FE**

- **FR-001**: Image FE PHẢI phục vụ build tĩnh của app web ở `/admin/` và trả `index.html` cho cả `/admin` (không dấu
  `/`), như Directus (`app.ts` `app.get('/admin', sendHtml)`); chạy bằng user không phải root.
- **FR-002**: Image FE PHẢI sinh cấu hình chạy (URL API) từ biến môi trường lúc container khởi động, từ chính biến của
  Directus (`PUBLIC_URL`), không thêm biến mới (Nguyên tắc VIII). Cùng một image chạy mọi môi trường.
- **FR-003**: Path dưới `/admin/` không ứng với file PHẢI trả `index.html` của app (SPA fallback), như Directus
  (`app.use('/admin/*', sendHtml)` sau static: kể cả path có đuôi file).
- **FR-004**: `index.html` PHẢI có `Cache-Control: no-cache`, file tĩnh `max-age=31536000, immutable`, cả hai kèm
  `Vary: Origin, Cache-Control`, như Directus; cấu hình chạy `no-store` (012).
- **FR-005**: Response của FE PHẢI có header CSP giống header Directus 11.17.4 trả cho `/admin` (mặc định của Directus
  `app.ts` cộng các biến `CONTENT_SECURITY_POLICY_*` trong env chung). Chuyển từ 012 (CHK077–079).
- **FR-006**: Image FE PHẢI có path cho probe không phụ thuộc BE (FE vẫn healthy khi BE mất).

**Image BE**

- **FR-020**: Image BE PHẢI thay được image `directus/directus:11.17.4` trong một service đang chạy mà chỉ đổi image:
  cùng cổng mặc định 8055, cùng thư mục làm việc `/directus`, cùng path volume (`/directus/uploads`,
  `/directus/database`, `/directus/extensions`), cùng uid/gid, cùng cách đọc env, `.env`, `CONFIG_PATH`, `_FILE` (001).
- **FR-021**: Image BE PHẢI chạy một process, không chạy migration hay ghi bảng hệ thống khi khởi động (D-19 của 001,
  Nguyên tắc II); biến chỉ Directus dùng chỉ gây cảnh báo.
- **FR-022**: Image BE PHẢI có nhãn phiên bản: phiên bản Backoffice và phiên bản Directus tương thích (11.17.4), và
  commit build.
- **FR-023**: Image BE và FE PHẢI build cho `linux/amd64` (Assumptions: arm64 ngoài phạm vi).
- **FR-024**: Tài liệu PHẢI ghi các giới hạn của "chỉ đổi image": DB phải đã được Directus bootstrap; bỏ ghi đè
  `command`/`args` gọi CLI Directus (ghi đè `command` trên Kubernetes còn bỏ qua init của FR-026); extension của Directus
  không chạy trên BE (Nguyên tắc XI).

**Bảo mật container**

- **FR-025**: Mọi container do 019 định nghĩa hoặc build PHẢI chạy tiến trình chính bằng user không phải root: BE (uid
  1000, `node`), FE (uid 101, nginx), load balancer của compose (image nginx unprivileged). Chart PHẢI đặt cho pod BE và FE
  `runAsNonRoot: true`, `runAsUser`/`runAsGroup` theo image, `allowPrivilegeEscalation: false`, `capabilities.drop: [ALL]`.
  Image bên thứ ba chỉ dùng cho dev (Postgres, Redis, MinIO) và image Directus: tiến trình chính sau entrypoint không phải
  root (Directus `USER node`, MinIO của Chainguard non-root, Postgres và Redis hạ quyền trong entrypoint); test kiểm uid của
  tiến trình chính mọi service.
- **FR-026**: Image BE PHẢI chạy một init nhỏ làm PID 1 (`tini`, cài từ kho package của Alpine trong image Node, không phải
  package npm) với `node dist/main.js` là tiến trình con: init dọn mọi tiến trình con mồ côi đã thoát (không để lại tiến
  trình zombie) và chuyển SIGTERM/SIGINT/SIGHUP cho Node; mã thoát của container là mã của Node (143 khi SIGTERM, FR-033).
  Trình tự tắt máy của 001 không đổi. FE không cần thêm: nginx master đã thu dọn worker của nó.

**Đa replica và tắt máy**

- **FR-030**: BE PHẢI chạy được với số replica bất kỳ (tối thiểu 1; CI kiểm 3 và 6 replica trên compose, 2 đến 4 trên
  cụm Kubernetes thử) cùng Directus, không cần
  sticky session: mọi trạng thái dùng chung giữa request (phiên, bộ đếm đăng nhập, rate limiter, cache, lock, dữ liệu dở
  của TUS) nằm ở DB, Redis hoặc storage dùng chung như Directus.
- **FR-031**: Readiness PHẢI dùng `GET /server/health`: replica chỉ nhận traffic khi health không phải `error`; khi nhận
  SIGTERM, health chuyển `error` ngay (FR-080 của 001).
- **FR-032**: Liveness PHẢI dùng `GET /server/ping` (Q2: A): DB hoặc Redis mất chỉ gỡ pod khỏi traffic (readiness),
  không làm khởi động lại mọi pod cùng lúc. Process treo không trả `/server/ping` thì bị khởi động lại.
- **FR-033**: Khi nhận SIGTERM, replica PHẢI: (1) báo không sẵn sàng; (2) vẫn nhận request trong khoảng trễ để load
  balancer gỡ nó khỏi danh sách; (3) ngừng nhận kết nối mới; (4) chạy nốt request dở tối đa `SERVER_SHUTDOWN_TIMEOUT`;
  (5) đóng DB, Redis, job theo lịch; (6) thoát với mã của tín hiệu (143). Khoảng trễ (2) PHẢI nằm ở cấu hình triển khai
  (compose, chart), không thêm biến env mới cho BE và không đổi trình tự tắt của 001.
- **FR-034**: Thời hạn tắt máy của container (compose `stop_grace_period`, pod `terminationGracePeriodSeconds`) PHẢI
  lớn hơn khoảng trễ (2) cộng `SERVER_SHUTDOWN_TIMEOUT` cộng thời gian đóng kết nối; giá trị mặc định và cách chỉnh ghi
  trong tài liệu.
- **FR-035**: Lỗi kết nối tới replica đã ngừng nhận PHẢI không tới client: load balancer của compose chuyển request chưa
  gửi được sang replica khác.

**Docker-compose cho máy dev**

- **FR-040**: PHẢI có một docker-compose chạy: Directus 11.17.4, BE (mặc định 2 replica), FE, Postgres, Redis, MinIO
  (bucket tạo sẵn, storage S3 cho cả Directus và BE), một load balancer nghe một cổng trên máy.
- **FR-041**: Directus và BE trong compose PHẢI dùng cùng một khối env (một file `.env` mẫu, secret sinh ngẫu nhiên như
  `dev/directus-reference`); khác nhau chỉ ở image.
- **FR-042**: Thứ tự khởi động PHẢI là: Postgres, Redis, MinIO healthy → Directus bootstrap và healthy → BE, FE → load
  balancer. Mọi service có healthcheck.
- **FR-043**: Số replica BE PHẢI đổi được lúc chạy lệnh (ví dụ 3 cho test chấp nhận) mà không sửa file.
- **FR-044**: Mỗi instance (từng replica BE và Directus) PHẢI gọi thẳng được từ test (không qua load balancer) để test
  US3–US5 nhắm đúng instance.

**Helm chart cho môi trường thật**

- **FR-045**: PHẢI có Helm chart tạo: Deployment, Service cho FE và BE; Ingress chung một domain; HPA cho BE (CPU, tối
  thiểu và tối đa replica khai báo được). Chart render ra manifest thường được (`helm template`) cho nơi không dùng Helm.
- **FR-046**: Chart PHẢI nhận tên ConfigMap và Secret đang cấp cho Directus và nạp nguyên vào BE (`envFrom`); chart
  KHÔNG chứa biến môi trường nào của Directus hay biến mới, trừ các biến phụ thuộc domain ở chế độ domain riêng
  (`PUBLIC_URL`, FR-071). FE chỉ nhận ConfigMap (không nhận Secret).
- **FR-047**: Chart PHẢI cho mount một PVC có sẵn (dùng chung với Directus) ở `/directus/uploads` khi storage là
  `local`; mặc định không mount.
- **FR-048**: Pod BE và FE PHẢI có readiness, liveness (FR-031, FR-032), cấu hình tắt máy (FR-033, FR-034), giới hạn tài
  nguyên khai báo được, chạy không phải root.
- **FR-049**: Chart PHẢI qua kiểm tra lint và kiểm schema manifest với Kubernetes [phiên bản hỗ trợ tối thiểu: xem
  Assumptions], và được cài thử trên một cụm cục bộ trong CI.

**Định tuyến**

- **FR-050**: Một domain: `/admin` và `/admin/*` vào FE; mọi path khác vào BE (cả `/`, để BE trả `ROOT_REDIRECT` như
  Directus). Pool nhận các path đó gồm cả replica BE lẫn instance Directus (Q1: A): compose đặt Directus cùng pool với
  các replica BE; chart tạo Service chọn pod theo một nhãn chung, Directus Deployment đang có chỉ cần thêm nhãn đó vào
  pod (tên nhãn khai báo được) để vào pool, bỏ nhãn để ra khỏi pool.
- **FR-051**: Load balancer (compose và Ingress) PHẢI không giới hạn kích thước body thấp hơn giới hạn của app, không
  đệm toàn bộ body upload, timeout đọc đủ cho request dài nhất được hỗ trợ; PHẢI chuyển `X-Forwarded-For`,
  `X-Forwarded-Proto`, `Host` để `IP_TRUST_PROXY` và `PUBLIC_URL` của Directus chạy như sau proxy.
- **FR-052**: Tài liệu triển khai PHẢI có mục định tuyến `/auth/login/<provider SAML>` và các path SAML về Directus cho
  hệ thống có user SAML (D-24 của 003), kèm ví dụ Ingress.
- **FR-053**: Khi cài hoặc nâng cấp chart, chart PHẢI đọc ConfigMap và Secret chung và dừng cài nếu thiếu một biến ở bảng
  "Bắt buộc" của mục "Env Directus bắt buộc khi chạy nhiều instance", theo đúng cách Directus đọc biến: không có Redis
  (`REDIS_ENABLED` khác `true` khi có biến này; khi không có thì không có `REDIS` và không có biến `REDIS_*` nào);
  `CACHE_STORE` hoặc `RATE_LIMITER_STORE` là `memory` hoặc không đặt (mặc định `memory`); `SYNCHRONIZATION_STORE` khác
  `redis` hoặc không đặt; không có `SECRET`; `DB_CLIENT` không đặt hoặc là `sqlite3`; `STORAGE_LOCATIONS` không đặt hoặc
  có location `local` mà `uploads.existingClaim` rỗng. Thông báo PHẢI nêu từng biến, giá
  trị đang có, ConfigMap/Secret, và giá trị cần đặt trong env của Directus. Compose đặt sẵn các giá trị đúng; tài liệu ghi
  lệnh tự kiểm cho nơi không dùng Helm.

**Test chấp nhận (BE 3 replica cộng 1 Directus)**

- **FR-060**: PHẢI có bộ test tự động chạy trên compose với BE 3 replica cộng 1 Directus, gồm đúng các test của US3,
  US4, US5, US6; mỗi test gọi thẳng từng instance khi cần (FR-044).
- **FR-061**: Test TUS PHẢI dùng file ít nhất 4 chunk, chunk xoay vòng qua cả 4 instance, kiểm byte trên storage và số
  dòng `directus_files`.
- **FR-062**: Test flow theo lịch PHẢI chạy ít nhất 10 lượt và kiểm đúng một lần chạy mỗi lượt.
- **FR-063**: Test schema PHẢI kiểm thay đổi hiện ở mọi instance ngay ở request đầu tiên sau response của thao tác sửa.
- **FR-064**: Test tắt replica PHẢI chạy tải liên tục (đọc và ghi) qua load balancer, gửi SIGTERM tới một replica BE,
  rồi thêm lại replica; ghi số request lỗi, mã thoát, thời gian thoát, số kết nối DB/Redis trước và sau.
- **FR-065**: CI PHẢI build cả hai image, chạy FR-060, FR-075 và FR-049 khi file đóng gói hoặc code BE/FE đổi trên
  `main`.

**Bản Backoffice ở domain riêng** (US9)

- **FR-070**: Compose và chart PHẢI có chế độ "domain riêng": FE và BE của Backoffice ở một domain riêng, pool API chỉ
  gồm replica BE; Directus giữ domain, Ingress, Deployment của nó và không vào pool. Chế độ "chung domain" (FR-050) vẫn
  là mặc định.
- **FR-071**: Ở chế độ domain riêng, bản Backoffice PHẢI dùng nguyên ConfigMap/Secret chung và chỉ đặt riêng
  `PUBLIC_URL`. Không biến nào khác được khai báo lại; chart không có chỗ nhận biến ghi đè nào khác.
- **FR-072**: FE ở chế độ domain riêng PHẢI gọi API ở chính domain của nó (theo `PUBLIC_URL` đã đặt riêng).
- **FR-073**: Hai bản PHẢI dùng chung DB, Redis (cache, bus, lock, bộ đếm, TUS) và storage S3; thay đổi ở một bản hiện ở
  bản kia ngay như US4.
- **FR-074**: Tài liệu PHẢI có mục chế độ domain riêng: biến phải đặt riêng, cấu hình SSO (callback, allow list), cookie,
  giới hạn cache của OAS, ví dụ values cho chart.
- **FR-075**: PHẢI có test tự động cho chế độ domain riêng trên compose, gồm các kịch bản của US9 (trừ SSO).
- **FR-076**: Ở chế độ domain riêng, khi cài hoặc nâng cấp chart, nếu ConfigMap hoặc Secret chung có
  `REFRESH_TOKEN_COOKIE_DOMAIN` hoặc `SESSION_COOKIE_DOMAIN` mà giá trị không phủ host của bản Backoffice (host khác giá trị
  và không kết thúc bằng `.<giá trị>`, bỏ dấu `.` đầu), chart PHẢI dừng cài và báo: tên biến, giá trị, ConfigMap/Secret
  chứa nó, host Backoffice, và cách sửa env của Directus (bỏ biến, hoặc đặt domain cha như `example.com`). Giá trị phủ được
  host thì không báo. Tài liệu ghi cùng kiểm tra này cho compose và cho cách triển khai không dùng Helm.

### Key Entities

- **Image FE**: build tĩnh app web + máy chủ web; cấu hình chạy sinh từ env lúc khởi động.
- **Image BE**: API Backoffice, thay thế được image Directus; một process mỗi container.
- **Instance**: một container BE hoặc Directus; ngang hàng trên cùng DB, Redis, storage.
- **Load balancer / Ingress**: một domain, chia `/admin/*` và phần còn lại.
- **Bộ cấu hình dùng chung**: `.env`, ConfigMap, Secret của Directus; nguồn env duy nhất cho mọi instance.

## Khác biệt so với Directus *(mandatory)*

| ID | Hạng mục | Directus 11.17.4 | App mới | Lý do | Loại | Duyệt (Nguyên tắc X) |
|----|----------|------------------|---------|-------|------|----------------------|
| D-120 | Ai phục vụ `/admin` | API phục vụ app (`SERVE_APP`), CSP do helmet của API | Container FE riêng (nginx) phục vụ `/admin`, gửi cùng header CSP; BE trả `404` cho `/admin` (D-08 của 001) | Nguyên tắc VII | khác | Duyệt (chủ dự án, 2026-10-20) |
| D-121 | Image và tiến trình | Image chạy `bootstrap` rồi PM2 (`PM2_INSTANCES`); PID 1 là `/bin/sh` (CMD dạng shell), không init | Một process Node dưới `tini` (PID 1, FR-026), không `bootstrap` (D-19 của 001); scale bằng replica | Nguyên tắc II, VII | khác | chờ tech lead (T005) |
| D-122 | Khoảng trễ trước khi ngừng nhận kết nối khi SIGTERM | Không có; ngừng nhận ngay | Có, đặt ở cấu hình triển khai (compose, chart), không đổi code tắt máy | FR-033: không lỗi request khi tắt replica | khác | Duyệt (chủ dự án, 2026-10-20) |

**Cần xác nhận**: Không có.

## Clarifications

### Session 2026-10-20

- Q1: Ở domain chung, load balancer gửi request API (ngoài `/admin`) chỉ tới replica BE hay cả Directus? → A: gồm cả
  Directus; Directus vào pool bằng một nhãn chung trên pod (FR-050).
- Q2: Liveness dùng `/server/health` hay `/server/ping`? → A: readiness `/server/health`, liveness `/server/ping`
  (FR-031, FR-032).
- Yêu cầu thêm của chủ dự án: "thêm 1 bản deploy backoffice dùng domain khác directus nhưng vẫn trỏ chung db, redis,
  s3" → US9, FR-070..FR-075. Đổi domain bắt buộc đặt riêng `PUBLIC_URL` (Directus dùng nó cho `Location` của TUS, link
  mời, share, đặt lại mật khẩu, callback SSO, bỏ qua cache theo Referer); đây là ngoại lệ có giới hạn của "không khai báo
  lại biến" (FR-071).
- Phân tích 2026-10-20 (`/speckit.analyze`): thêm FR-053 (kiểm cấu hình đa instance, gồm `SYNCHRONIZATION_STORE`), sửa
  US7 kịch bản 3, FR-030, SC-001 cho khớp với test; D-120..D-122 và ngoại lệ VIII chờ tech lead duyệt (T005, T079).
- Chủ dự án (2026-10-20): `REFRESH_TOKEN_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN` không đặt riêng cho bản Backoffice; "nếu
  như có sẵn và cần thiết thì báo tôi sửa env của directus" → FR-076 (chart dừng cài và báo), FR-071 chỉ còn `PUBLIC_URL`.

## Assumptions

- Làm trên `main`, không tạo branch (quy ước của dự án).
- Chọn Helm chart (người yêu cầu cho chọn manifest hoặc Helm); `helm template` cho ra manifest thường nên vẫn dùng được
  ở nơi không cài Helm.
- CI đã đẩy image lên Docker Hub (`.github/workflows/ci.yml` job `publish`: `hiennd23/backoffice-{api,web}` tag
  `latest` và SHA commit, sau khi mọi cổng đạt); 019 thêm các job test triển khai vào danh sách cổng của `publish`.
  Registry và tag là tham số của chart, mặc định là các image này.
- Storage cho nhiều replica là S3 (hoặc tương thích S3) hoặc PVC `ReadWriteMany` dùng chung; GCS, Azure ngoài phạm vi
  (Nguyên tắc XI).
- Production chạy `linux/amd64` (image BE đã ghim amd64 vì byte AVIF khác trên arm64, 007); arm64 ngoài phạm vi.
- Kubernetes hỗ trợ từ 1.29 trở lên (HPA `autoscaling/v2`, Ingress `networking.k8s.io/v1`). Ingress là tài nguyên
  chuẩn, annotation riêng của controller khai báo qua values; tài liệu có bộ annotation cho các controller phổ biến
  (research R8).
- App ở gốc domain như bố cục Directus; `PUBLIC_URL` có path con ngoài phạm vi.
- TLS kết thúc ở Ingress hoặc load balancer ngoài; compose dev chạy HTTP.
- Bật lại lịch nightly (001 FR-112) không thuộc 019; chủ dự án quyết sau khi 019 đóng.
- Chủ dự án (2026-10-20, "mặc định bật REDIS"): env thật của Directus đã bật Redis sẵn (`REDIS`, các `*_STORE=redis`).
  FR-053 chỉ là lưới an toàn: cài chart trên env đó không bị dừng; chỉ báo khi thiếu (ví dụ chưa có
  `SYNCHRONIZATION_STORE=redis`). Compose dev bật Redis sẵn. Chart không cài Redis riêng và không tự đặt `*_STORE`.
- Chủ dự án (2026-10-20): dùng image non-root; image Node của BE thêm thư viện chặn tiến trình zombie → FR-025, FR-026
  (`tini` từ kho Alpine; lý do chọn ở research R3).
- Cảnh báo một instance của 001 (`apps/api/src/config/warn-single-instance.ts`) chưa có `SYNCHRONIZATION_STORE`. Thêm vào
  đó là sửa code API, ngoài phạm vi 019 (019 không sửa `apps/api/src`); 019 kiểm ở chart (FR-053) và tài liệu.
- Test chấp nhận chạy trên compose; trên cụm Kubernetes cục bộ CI chỉ kiểm cài chart, probe, định tuyến Ingress và
  rolling update dưới tải.

## Env Directus bắt buộc khi chạy nhiều instance

Áp cho cấu hình chung (`.env`, ConfigMap, Secret) mà mọi instance Directus và Backoffice cùng đọc. Kiểm trong source
Directus 11.17.4 ngày 2026-10-20; mặc định lấy từ `directus/packages/env/src/constants/defaults.ts`.

**Bắt buộc** (thiếu thì hệ thống nhiều instance chạy sai):

| Biến | Giá trị cần | Mặc định Directus | Thiếu thì sao | Nguồn |
|------|-------------|-------------------|---------------|-------|
| `DB_CLIENT` + `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD` (hoặc `DB_CONNECTION_STRING`) | cùng một DB thật cho mọi instance | image đặt `sqlite3` với file trong container | mỗi container một DB riêng | `apps/api/Dockerfile`, `directus/Dockerfile` |
| `SECRET` | một chuỗi cố định, giống nhau ở mọi instance | không có; mỗi process tự sinh ngẫu nhiên | token do instance này cấp bị instance kia từ chối | `directus/api/src/utils/get-secret.ts:13-18` |
| `REDIS` (hoặc `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`...) | trỏ cùng một Redis | không có | bus xóa cache schema/quyền và lock chỉ chạy trong từng process | `directus/api/src/bus/lib/use-bus.ts:18`, `lock/lib/use-lock.ts:17`, `redis/utils/redis-config-available.ts` |
| `REDIS_ENABLED` (nếu có đặt) | `true` | không có | có đặt mà khác `true` thì Redis bị tắt dù có `REDIS` | như trên |
| `CACHE_STORE` | `redis` | `memory` | cache hệ thống và lock cache riêng từng instance (kể cả khi `CACHE_ENABLED=false`) | `directus/api/src/cache.ts:62-84` |
| `RATE_LIMITER_STORE` | `redis` | `memory` | bộ đếm đăng nhập sai (`AUTH_LOGIN_ATTEMPTS`) đếm riêng từng instance (kể cả khi `RATE_LIMITER_ENABLED=false`) | `directus/api/src/services/authentication.ts:34` |
| `SYNCHRONIZATION_STORE` | `redis` | không có (dùng bộ nhớ process) | flow theo lịch, job dọn TUS, retention chạy trên mọi instance | `directus/api/src/synchronization.ts:20` |
| `STORAGE_LOCATIONS` + `STORAGE_<LOCATION>_DRIVER` và khóa của driver | `s3` (hoặc `local` trên volume `ReadWriteMany` dùng chung) | `local` | mỗi container thấy file khác nhau | Nguyên tắc VII |

**Bắt buộc theo tình huống**:

| Biến | Khi nào | Giá trị cần |
|------|---------|-------------|
| `PUBLIC_URL` | dùng SSO, share, link mời; chế độ domain riêng | URL thật của domain (mặc định `/`); chế độ domain riêng: bản Backoffice đặt riêng (FR-071) |
| `TUS_ENABLED` | muốn upload TUS (mặc định `false`) | `true`; cần thêm `REDIS` và storage dùng chung |
| `REFRESH_TOKEN_COOKIE_DOMAIN`, `SESSION_COOKIE_DOMAIN` | chế độ domain riêng | không đặt, hoặc domain cha phủ cả hai domain (FR-076) |
| `AUTH_<PROVIDER>_REDIRECT_ALLOW_LIST`, `AUTH_ALLOWED_PUBLIC_URLS` | SSO và chế độ domain riêng | thêm URL của domain Backoffice |

**Khuyến nghị**:

| Biến | Giá trị | Lý do |
|------|---------|-------|
| `WEBSOCKETS_ENABLED` | `false` (mặc định) | Backoffice không có `/websocket` (Nguyên tắc XI); Directus trong cùng pool mà bật thì chỉ một phần instance trả được |
| `CACHE_ENABLED`, `CACHE_AUTO_PURGE` | tùy; compose đặt `true` | response cache dùng chung qua `CACHE_STORE=redis` |
| `SERVER_SHUTDOWN_TIMEOUT` | lớn hơn request dài nhất cần giữ khi tắt (mặc định 1000 ms) | FR-033, edge case request dài |
| `IP_TRUST_PROXY` | giữ mặc định `true` | đứng sau load balancer (FR-051) |

Các biến "Bắt buộc" là bảng kiểm của chart (FR-053) và của tài liệu cho compose, manifest thường.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Với BE 3 replica cộng 1 Directus, 100% test chấp nhận (US3–US6) đạt trong 10 lần chạy liên tiếp của
  `parity-tests:deploy` (một vòng lặp chạy lại cả bộ, mỗi lần dựng env mới), trước khi đóng feature.
- **SC-002**: Khi tắt một replica BE dưới tải liên tục, 0 request lỗi trên tổng số request trong lần chạy (ít nhất
  5.000 request); replica thoát trong thời hạn tắt máy đã khai báo.
- **SC-003**: Rolling update toàn bộ BE trên cụm Kubernetes thử dưới tải: 0 request lỗi.
- **SC-004**: Thay image Directus bằng image BE: số dòng cấu hình (env, volume, probe, cổng) phải sửa ngoài dòng image =
  0 (trừ trường hợp ghi đè `command` của FR-024).
- **SC-005**: Flow theo lịch: số lần chạy = số lượt, sai lệch 0, qua ít nhất 10 lượt.
- **SC-006**: Upload TUS qua 4 instance: 100% upload hoàn tất, file giống byte với file gốc.
- **SC-007**: Từ máy chỉ có Docker, lập trình viên dựng được hệ thống dev và đăng nhập được qua `/admin` bằng một lệnh,
  trong dưới 10 phút khi đã có image (không tính thời gian tải image).
- **SC-008**: Replica BE mới sẵn sàng nhận traffic trong dưới 30 giây kể từ khi container khởi động (DB và Redis sẵn
  có).
- **SC-009**: Chart cài vào namespace có Directus mà không khai báo lại biến nào: số biến môi trường Directus trong chart
  = 0 ở chế độ chung domain, và đúng 1 (`PUBLIC_URL`) ở chế độ domain riêng.
- **SC-010**: Chế độ domain riêng: 100% kịch bản US9 (trừ SSO) đạt; 0 thay đổi trên Deployment, Service, Ingress của
  Directus.
