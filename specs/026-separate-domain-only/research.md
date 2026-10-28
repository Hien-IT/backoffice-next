# Research: Backoffice chạy cạnh Directus chỉ ở domain riêng (026)

Ngày 2026-10-28. Đọc file ở `main` (chưa chạy thử; số dòng là của hôm đó). Mọi "Quyết định" dưới đây là của plan, trong
khuôn khổ các câu chủ dự án đã chốt (Q1–Q7, bảng quyết định trong `SPECKIT-GUIDE.md`).

## R1. Compose mặc định: một `lb`, hai cổng

**Quyết định**: giữ một container `lb` (nginx-unprivileged) nghe hai cổng như `lb/separate-domain.conf` hiện nay: 8080 →
`directus:8055` (domain D, map 8090), 8081 → `/admin` FE, còn lại upstream `bo_pool` chỉ `backoffice-api` (domain B,
map 8091). File conf đổi tên `lb/separate-domain.conf` → `lb/shared.conf` (cùng tên với `mode: shared` của chart, Q4:
"chạy cạnh Directus"); `lb/shared-domain.conf` và `docker-compose.separate-domain.yml` xóa; `PUBLIC_URL=http://localhost:8091`
đặt trong `environment` của `backoffice-api`, `backoffice-web` ngay trong `docker-compose.yml`; `.env` giữ
`PUBLIC_URL=http://localhost:8090` của Directus (Q3). Chi tiết: `contracts/compose.md`.

**Lý do**: bố cục này đã chạy và có test (`separate-domain.test.ts`, lượt CI `separate-domain`); gộp vào mặc định là đổi
hai dòng `ports`/`volumes` và hai `environment`, không viết conf mới. Tên `shared` tránh giữ tên một chế độ không còn là
lựa chọn.

**Đã cân nhắc**: hai container `lb` (thêm service, healthcheck, depends_on: không thêm gì cho test); giữ tên
`separate-domain.conf` (ít đổi hơn một `git mv` nhưng README phải giải thích tên); Backoffice ở 8090 như standalone (Q3:
không; standalone giữ 8090 vì không có Directus).

**Bẫy khi gộp** (phải xử lý trong override standalone, FR-011):

- `docker-compose.standalone.yml` không đụng `environment`, nên `PUBLIC_URL: http://localhost:8091` của base sẽ lọt vào
  standalone (Backoffice ở 8090: `config.json` và `Location` TUS sai). Override thêm `environment: !reset` cho
  `backoffice-api`, `backoffice-web` (về `.env`, Nguyên tắc VIII) và `ports: !override ['8090:8080']` cho `lb` (không mở
  8091). `!reset`/`!override` cần Compose ≥ 2.24.4, điều kiện 021 đã đặt. Test standalone "gives bootstrap and the
  replicas the same env file" sẽ bắt lỗi nếu quên.
- `lb/standalone.conf` giữ nguyên (có `location /extensions/sources/` trỏ cùng pool, vô hại; FR-011).
- `docker-compose.shared-extensions.yml`, `docker-compose.eticket.yml`, `init-env.sh`, `.env.example`, `.env.deploy-test`
  không đổi.

## R2. Bộ test deploy

**Quyết định**: `instances.ts` bỏ `SEPARATE`; `lbUrl` → `directusLbUrl` (8090, domain D qua lb), thêm
`boLbUrl` (8091; standalone 8090) và `BO_PUBLIC_URL`; `separate-domain.test.ts` → `domains.test.ts` chạy ở lượt mặc định
(`skipIf(STANDALONE)`); các test tải qua lb (`smoke`, `compose`, `shutdown`, `extensions`, `backoffice-permissions`) dùng
`boLbUrl`; các test gọi thẳng instance (`sessions`, `schema`, `flows-schedule`, `tus`) chỉ bỏ `skipIf(SEPARATE)`;
`image-swap` giữ (gọi thẳng container, Q7). Bảng từng file: `contracts/tests.md`.

**Lý do**: giữ đúng các bài của 019 US3–US6 (3 replica + 1 Directus, gọi thẳng) và US9 (hai domain) trong một lượt; chỉ
đổi URL vào lb. Case "spreads over the BE replicas and Directus (FR-050)" và case D-137 đếm upstream mất ý nghĩa (pool
không còn Directus) → thay bằng "chỉ replica" (có sẵn ở describe standalone) và "Directus domain chỉ tới Directus" (có sẵn
ở `separate-domain.test.ts`).

**Đã cân nhắc**: giữ `lbUrl` với nghĩa đổi theo chế độ (8090 là Directus ở mặc định, Backoffice ở standalone): dễ dùng
nhầm; gộp `domains.test.ts` vào `compose.test.ts`: file dài, diff lớn hơn một `git mv`.

## R3. Helm chart

**Quyết định** (chi tiết `contracts/helm-values.md`):

- Bỏ `apiPool`, `backoffice.pool`, nhãn `backoffice.io/api-pool`; Service `-api` chọn
  `backoffice.selector` (name, instance, component `api`) như Service `-api-only` hiện nay; xóa `api-only-service.yaml`;
  Ingress còn `extraPaths` → `/admin` → `/`.
- `domain.publicUrl` bắt buộc ở `mode: shared`: `fail` đặt đầu `backoffice.checks`, trước `lookup`, để `helm template`,
  `--dry-run=client` và `test-template.sh` cũng dừng (US2-1, US3-1, SC-006). Kiểm cookie FR-076 chạy ở mọi lần
  `mode: shared`; host so sánh là `ingress.host`, hoặc host của `domain.publicUrl` (`urlParse` của Sprig) khi
  `ingress.enabled=false`.
- `values-separate-domain.yaml` xóa (Q5); ví dụ values ở README. `extraPaths` giữ value, bỏ ví dụ SAML (FR-010).
- Chart không đọc, không sửa Deployment Directus (Q6): pod Directus còn nhãn cũ không khớp selector nào.

**Lý do**: Service `-api-only` đã là "chỉ pod BE của release": lấy selector đó cho Service `-api` là cách ngắn nhất.
`fail` trước `lookup` vì `lookup` trả rỗng khi `helm template`; thiếu domain phải dừng ở mọi đường (SC-006).

**Hệ quả khi `helm upgrade` một release 019** (ghi vào README mục chuyển đổi): đổi selector Service là sửa tại chỗ; bỏ
nhãn pod template → rolling update của `-api` (maxUnavailable 0, không mất request); Helm xóa Service `-api-only` và ba
path Ingress; Ingress đổi host → Traefik/ingress-nginx cập nhật route, user đăng nhập lại ở domain B.

**Đã cân nhắc**: giữ `apiPool` như value "không dùng" (trái FR-006, SC-001); tự gỡ nhãn trên Directus (Q6: không).

## R4. Kind và kiểm template

**Quyết định**: `ci/values-kind.yaml` thêm `ingress.host: backoffice.test`, `domain.publicUrl: http://backoffice.test`;
`kind-test.sh` gọi Backoffice qua `Host: backoffice.test` (Traefik định tuyến theo host của Ingress), Directus qua
port-forward 18055 như hiện nay (`deps.yaml` không có Ingress cho Directus); kiểm "Directus không đổi" bằng
`metadata.generation` của `deployment/directus` trước/sau `helm install` (SC-004); giả lập pod còn nhãn cũ bằng chính
`kubectl patch` hiện có ở :50 rồi kiểm endpoints `bo-api` không chứa IP Directus (US2-3); thêm `helm upgrade` không
domain phải lỗi (US3-1); extension 020 kiểm Directus qua 18055 (FR-040 của 020 giữ). `test-template.sh` theo
`contracts/tests.md`. `load.mjs` đã nhận host làm tham số thứ hai (`node load.mjs "$base" cms.test ...`).

**Lý do**: dùng lại từng bước của 019/020/021, chỉ đổi host và đảo chiều hai assert.

**Đã cân nhắc**: thêm Ingress `cms.test` cho Directus trong `deps.yaml` để kiểm "domain D chỉ tới Directus" qua Traefik:
không cần, Directus không đổi và kind không kiểm Directus (SC-004 đo bằng `generation`).

## R5. CI

Job `deploy`: bỏ lượt `DEPLOY_MODE: separate-domain` (2 lượt: mặc định, standalone; SC-002), các bước còn lại giữ
(`--profile shared-only` là profile của override standalone, không phải "shared domain"). Job `deploy-k8s`: không đổi
bước (script mới). `benchmark.yml` không dùng `deploy/compose` (xác nhận 2026-10-28 ở bước specify). [Inference] job
`deploy` ngắn hơn ~5 phút vì bớt một lượt dựng compose.

## R6. `deploy/README.md`

| Mục (dòng 2026-10-28) | Đổi |
|------------------------|-----|
| Mục lục :20-24 | thêm "Chuyển từ chung domain sang domain riêng"; "Domain riêng" đổi tên "Chạy cạnh Directus: hai domain" |
| Thay image :27-50 | thêm câu Q7: service đã đổi image phục vụ domain Backoffice, đặt riêng `PUBLIC_URL`, không ở pool của domain Directus |
| Máy dev :69-92 | bảng cổng: 8090 = Directus qua lb (Directus app ở `/admin`), 8091 = Backoffice (`/admin` FE, còn lại replica BE), 8095, ngẫu nhiên; câu "Test chấp nhận" giữ |
| Extensions :162-164 | bỏ bullet "Load balancer: `/extensions/sources/*` chỉ tới Backoffice" (ở domain B mọi path tới BE) |
| Tắt máy an toàn :173-191 | không đổi (không nhắc Directus trong pool) |
| Domain riêng :193-226 | thành mục bố cục mặc định: bỏ "Dùng khi muốn..."; compose = lệnh mặc định; Kubernetes = `ingress.host` + `domain.publicUrl` (bắt buộc), ví dụ values; Cookie domain, SSO, Phiên, Cache giữ; thêm "PUBLIC_URL khác nhau: link trong thông báo, `Location` TUS, callback SSO mang domain của app ghi" |
| Kubernetes :228-303 | "Ingress chung một domain" → "Ingress trên domain Backoffice"; bảng value: bỏ `apiPool.name`, `domain.publicUrl` "bắt buộc ở `shared`"; "Kiểm cấu hình khi cài": thiếu domain → dừng, cookie domain mọi lần; thay "Đưa Directus vào pool" :265-267 bằng mục "Chuyển từ chung domain sang domain riêng" (DNS, values, trả host D về Ingress Directus, gỡ tay nhãn pool (tùy chọn), SSO allow list, `helm upgrade`, đăng nhập lại); đoạn 023 :269-273 và 024 :275-280: bỏ "ở chế độ chung domain request rơi vào Directus..." → "gọi thẳng domain Directus thì Directus trả lời như Directus 11.17.4"; SAML :294-303: user SAML chỉ dùng Directus app ở domain D (Q1), bỏ ví dụ `extraPaths` |
| Chạy độc lập :305-380 | :324 giữ; :362 bỏ "không gắn nhãn pool cho Directus"; đoạn "Chế độ chung (`mode: shared`, compose mặc định)" :364 giữ |
| Quyền import, export :415-441 | :434-438 "Directus chạy chung": bỏ "request import, export tới Directus vẫn trả 200" theo nghĩa lb → "gọi thẳng domain Directus"; :439-441 bullet D-189.7 bỏ |

## R7. FR-015: rà soát chỗ lệch luồng Directus vì chung domain (lượt đủ)

Cách quét (2026-10-28, ba lượt đọc độc lập trên `main`): (a) spec 001–012 và (b) spec 013–025 (trừ 019): mọi bảng "Khác
biệt so với Directus", Edge Cases, Clarifications, Assumptions, "Cần xác nhận", bảng khảo sát, cộng grep các từ "chung
domain", "cùng domain", "một domain", "same/shared domain", "shared-domain", "separate-domain", "cùng origin", "pool",
"load balancer", "lb", "Ingress", "rơi vào/đi vào/tới Directus", "instance nào", "/admin/shared", "apiPool", "bo_pool",
"api_pool"; (c) code: `apps/api/src`, `apps/web/src`, `apps/web-e2e`, `libs`, `tests/parity/src` (trừ `deploy`),
`tests/directus-app-e2e`, `deploy/` với các từ trên và "API is DR", "lands on", "DR answers", "cross-site", "DEPLOY_MODE".
Kết quả [Inference: đọc văn bản, chưa chạy thử]:

### Kết luận

1. **Không có code nào trong `apps/api`, `apps/web`, `libs` lệch luồng Directus vì chung domain.** Những gì được thêm
   riêng vì chung domain chỉ là định tuyến ở lb và Ingress (020 FR-047, 025 FR-031/D-189.7) và nhãn pool của chart:
   gỡ ở FR-009, FR-006. Không có dòng "Gỡ" nào chạm `apps/*`, nên không cần chủ dự án duyệt thêm (FR-015).
2. Các chỗ còn lại là **câu chữ** giả định "hai app sau một load balancer, request rơi vào instance nào cũng được" (003,
   004, 020, 023, 024, 025, 014, 021) hoặc là **tiền đề của bộ parity** (007–010: "hai app cùng `PUBLIC_URL`") và môi
   trường test, giữ nguyên.
3. Phát hiện mới so với lượt đầu: (i) 003 (US intro, US1/US2 "Why", edge case SSO callback, D-24, assumption SAML) và
   004 (US intro) tả bố cục chung lb; (ii) 007, 008, 009, 010 Assumptions "hai app cùng `PUBLIC_URL`" chỉ đúng ở parity
   env, khi chạy cạnh Directus hai app khác `PUBLIC_URL` (đã vậy từ 019 US9) → thêm edge case vào spec 026; (iii) 021
   FR-072 nêu override `separate-domain` (sẽ xóa) và FR-080/FR-103/FR-104 so với "chế độ chung của 019"; (iv) 014 "Cần
   xác nhận" hai câu về cùng domain; (v) 020 còn "Đã có", US2 intro, FR-062 trỏ FR-047.

### Bảng xử lý (bản đầy đủ của bảng trong spec; "ghi chú" = "(026: ...)" ngay tại chỗ, FR-014)

| Nguồn | Chỗ | Xử lý |
|-------|-----|-------|
| 003 | US intro ("song song sau một load balancer"), US1 Why, US2 Why ("refresh rơi vào instance kia"), Edge case SSO callback rơi vào bên kia | Sửa chữ: giữa các replica BE vẫn đúng; giữa hai app là token/cookie `openid.*` ký `SECRET` chung (Nguyên tắc IV 3.3.0). Một ghi chú ở US intro, một ở edge case |
| 003 | D-24, Assumption "định tuyến `/auth/*` của user SAML về Directus" | Sửa chữ: user SAML dùng Directus app ở domain D (Q1); ghi chú tại D-24 và Assumption |
| 004 | US intro ("song song sau một load balancer"), "qua app Directus trỏ vào app mới" | Sửa chữ một ghi chú ở US intro (app Directus trỏ vào app mới = E2E qua proxy, FR-106) |
| 001 | US2 "thay được Directus sau load balancer", D-08..D-13 (`/admin` 404), Assumptions | Giữ: hợp đồng image (Q7), hành vi API |
| 004 | SC-007 ".env nguyên" | Giữ: compose đặt `PUBLIC_URL` ở `environment`, `.env` nguyên |
| 005 | FR-013 Referer `PUBLIC_URL/admin`; Clarifications cache HIT chéo | Giữ: theo `PUBLIC_URL` của từng app; Redis chung |
| 006 | Edge case hai app đổi schema | Giữ: DB chung |
| 007, 008, 009, 010 | Assumptions "hai app cùng `PUBLIC_URL`" (tiền đề parity) | Giữ, không ghi chú: parity env dùng chung `.env`; khi chạy cạnh Directus hai app khác `PUBLIC_URL` (019 FR-071, 026 FR-003) → edge case mới ở spec 026 ("link trong thông báo, `Location` TUS, callback SSO mang domain của app ghi") |
| 008 | FR-042 link `PUBLIC_URL/admin/content/...`; 010 FR-044 link share/file | Giữ: link mang domain của app ghi, cả hai domain hợp lệ |
| 010 | US8 "/extensions trả đủ để app Directus mở" | Giữ: E2E qua proxy |
| 012 | Edge case "Triển khai khuyến nghị cùng origin sau reverse proxy (/admin → app, còn lại → API)"; FR-071; US7; Clarifications origin | Giữ: FE với BE của Backoffice cùng origin ở domain B; ba cấu hình E2E là môi trường test |
| 004–011 | FR "E2E app Directus qua reverse proxy" (`tests/directus-app-e2e`) | Giữ: test parity API (Nguyên tắc III, V) |
| 014 | "Cần xác nhận": localStorage "(khác origin `/admin` chỉ khi cùng domain...)", link share "(cùng reverse proxy)" | Sửa chữ: ghi chú D-39 không vì domain; link share đã bị 025 D-189.4 thay |
| 014 | US5 kịch bản 3 link share `<origin>/admin/shared/<id>`; Edge case live preview cùng origin | Giữ (D-189.4 đã bỏ share; preview là iframe `preview_url`) |
| 015, 017 | localStorage/TFA; webhook URL theo cấu hình E2E | Giữ |
| 020 | "Đã có" (shared-domain.conf, api_pool), US1 Why, US2 intro, FR-047, D-137 ghi chú, Clarifications ×2, FR-062 "Chỉ API Backoffice trả bundle (FR-047)" | Gỡ (FR-009) + ghi chú tại FR-047, D-137, Clarifications; US1 Why/US2 intro/FR-062: ghi chú một dòng |
| 020 | FR-040, Input, US2 Independent Test, FR-051, SC-003 ("3 replica + 1 Directus", "mọi node trong pool") | Sửa chữ FR-040 (lý do: chung DB `directus_extensions`, storage, bus; hook chạy ở app nhận request); Independent Test/SC-003 giữ (gọi thẳng từng node) |
| 020 | D-140, Edge case sandbox abort, R-58 | Giữ |
| 021 | FR-083 (`apiPool`, `extraPaths` cho Directus), FR-072 (override `separate-domain`) | Sửa chữ: ghi chú tại FR-083 và FR-072 |
| 021 | FR-070, FR-080, FR-103, FR-104, US5-4, US6-5 ("chế độ chung của 019", "không có Directus trong pool") | Giữ: "chế độ chung" = `mode: shared`/compose mặc định cạnh Directus; một ghi chú ở FR-080 |
| 021 | US6 kịch bản 4, Edge case migration | Giữ |
| 023 | Edge case shared-domain, khảo sát dòng 10 + kết luận, D-184 câu "Ở shared-domain", Clarifications, Assumption | Sửa chữ: ghi chú tại D-184, Edge case, Clarifications, Assumption; khảo sát giữ như lịch sử + ghi chú |
| 023 | Edge case response cache | Giữ: Redis chung |
| 024 | Edge case, FR-016 câu cuối, khảo sát dòng 12 + kết luận, D-188 câu "Ở shared-domain", Clarifications, Assumption | Sửa chữ: ghi chú như 023 |
| 024 | US5-4, khảo sát dòng 8, D-188.4 | Giữ |
| 025 | FR-031, D-189.7, Clarifications "Lb, Ingress?", "Duyệt 2026-10-28 (kể cả ... định tuyến lb/Ingress)", khảo sát dòng 17 + kết luận, FR-033 phần "định tuyến lb" | Gỡ (FR-009) + ghi chú tại FR-031, D-189.7, Clarifications, FR-033 (deploy test thành "trả ở domain Backoffice") |
| 025 | D-189.1 câu "Ở shared-domain", FR-032, Edge case `/permissions/me` thiếu khóa (FR-034), Edge case link share cũ, US5-2 | Sửa chữ: ghi chú tại D-189.1, FR-034 edge case, edge case link share (link mở được ở domain D) |
| 025 | D-189.2, D-189.4, khảo sát dòng 9 | Giữ |
| 019 | toàn bộ | Đã có ghi chú đầu spec (bước specify); bảng "Phần của các spec trước bị thay" |
| Code `apps/api`, `apps/web`, `libs`, `tests` | (R7 phần code, dưới) | |

### Code (lượt c)

| Chỗ | Xử lý |
|-----|-------|
| `apps/web/src`: `stores/permissions.ts:9,40-42` và test, `use-collection-permissions.ts:38-40`, `SystemPermissions.vue:81`, `PermissionsRow.vue:17`, `PermissionsHeader.vue:4`, `use-bo-permissions.ts:83`, `policies/use-duplicate.ts:68` và test ("khi API là DR") | Giữ: lý do còn lại là cấu hình E2E `proxy-directus` và response cache chung (D-189.2); comment đã nêu đúng hai lý do đó, không nhắc pool |
| `apps/web/src/components/files/ImageEditor.vue:610`, `runtime-config.ts:4,21`, `vite.config.ts:11`, `extensions.ts:46` | Giữ: origin FE–BE của Backoffice, cấu hình `cors`, route của Directus |
| `apps/api/src`: `app-pipeline.ts:168`, `cache.ts:144`, `middleware/cache.ts:4`, `extract-token.ts:46`, `auth.controller.ts:146`, `backoffice-permissions.controller.ts`, `warn-unsupported-variables.ts:15`, `router-options.test.ts`, `cast-on-read.ts:31`, `database/index.ts:276` | Giữ: Redis/DB chung, bản port Directus, route của Directus; không có nhánh "request có thể rơi vào Directus" |
| `apps/web-e2e`: `settings-permissions-bo.spec.ts`, `settings-roles-policies.spec.ts`, `content-collection-toggles.spec.ts`, `content-filter-json-path.spec.ts` ("behind proxy-directus the API is Directus"), `sso.spec.ts`, `password-invite.spec.ts`, `playwright.config.ts:42`, `helpers/config.ts:24`, `settings-cross-use.spec.ts:131` | Giữ: ba cấu hình E2E là môi trường test (Assumptions) |
| `libs/*`, `tests/directus-app-e2e` | Không có gì |
| `tests/parity/src` (trừ `deploy`): `system/extensions.test.ts:23` ("every node of the pool"), `parity.ts:213`, `request-set.ts`, `permissions/backoffice-permissions.test.ts:165`, `proxy-conf.test.ts` | Giữ: parity env không có lb; "pool" là tập node chung DB/Redis |
| `tests/parity/accepted-differences.ts:501-505` (D-189.7, `kind: 'doc'`, reason "The shared-domain lb and the Ingress send ...") | Sửa chữ: reason thành "Removed by 026: next to Directus, Backoffice is on its own domain, every path of that domain reaches the BE" (giữ id để bảng chấp nhận không mất dòng; đổi `reason` không ảnh hưởng test, `kind: 'doc'`) |
| `tests/parity/README.md:302` | Giữ (chỉ nhắc `DEPLOY_MODE=standalone`); không nhắc `separate-domain` |
| `deploy/`: mọi chỗ (compose, lb conf, chart, ci, README) | Đã nằm trong R1–R6; thêm từ lượt c: `lb/standalone.conf:1` chú thích "like shared-domain.conf" → trỏ `shared.conf`; `_checks.tpl:5` chú thích "on a separate domain"; `test-template.sh:138` tên check "FR-076: shared domain ignores cookie domains" → bỏ; `values.yaml:76,84` chú thích "shared domain / separate domain" |
| `CLAUDE.md`, `.github/workflows/ci.yml` | R5, R8 |

Chưa quét: `apps/web/docker/*` (nginx, csp.awk, 40-config.sh), `apps/web/vite-plugin-extensions.ts` (ngoài phạm vi
lượt c; [Inference] không liên quan domain: CSP và bundle extension không phụ thuộc Directus ở pool).

### Quy ước ghi chú (FR-014)

Dạng `(026: <một câu>)` đặt ngay sau câu hoặc trong ô bảng; dòng của bảng D-xx thêm vào ô "Lý do"/cuối ô. Không viết
lại nội dung cũ, không xóa câu cũ. Một dòng của bảng gồm nhiều chỗ kề nhau thì một ghi chú ở chỗ đầu.

## R8. Ghi chú trỏ về 026 ngoài spec

- `CLAUDE.md`: dòng 019 (bỏ "separate-domain override with its own PUBLIC_URL" → "Backoffice on its own domain next to
  Directus, only PUBLIC_URL set apart (026)"), dòng 020 ("lb/Ingress route /extensions/sources to Backoffice only" →
  bỏ, 026), dòng 025 ("lb and Ingress route /permissions/me and /backoffice/ to Backoffice (D-189.7)" → "D-189.7 gỡ bởi
  026"), dòng Recent Changes của 025; thêm dòng 026 (qua `update-agent-context.sh` rồi sửa tay cho đúng mẫu).
- `SPECKIT-GUIDE.md`: trạng thái 026; mục 7 không đổi.
- `deploy/README.md`: R6.

## R9. Không đổi (xác nhận)

`docker-compose.standalone.yml` (ngoài R1), `lb/standalone.conf`, `docker-compose.shared-extensions.yml`,
`docker-compose.eticket.yml`, `tests/parity/docker-compose.yml` và profile parity, ba cấu hình E2E của `apps/web-e2e`,
`tests/directus-app-e2e`, `image-swap.test.ts`, `benchmark.yml`, code `apps/*`, `libs/*`, image API và web, Chart.yaml.

## R10. Rủi ro, chưa kiểm

- Không xác minh được có môi trường thật đang chạy chung domain; US3 chỉ có trên kind (helm upgrade không domain → dừng).
- `urlParse` của Sprig trả `host` kèm cổng khi URL có cổng (`backoffice.test:8080`): kiểm cookie dùng
  `ingress.host` trước, chỉ fallback khi Ingress tắt; test-template có case fallback.
- Rolling update của `-api` khi nâng cấp từ 019 (bỏ nhãn pod): không mất request nhờ `maxUnavailable: 0`, chưa đo.
- Thời gian job `deploy-k8s` tăng ít (một `helm upgrade` thất bại thêm) [Inference].

## Kết quả T001 (2026-10-28)

- Docker 29.8.2 (arm64), Compose v5.5.0 (`!override`, `!reset` dùng được); Helm v4.2.0 (CI ghim 4.3.0); không có `kind`,
  `kubeconform` local → kind và kubeconform chỉ chạy ở CI `deploy-k8s` (T023, T029).
- Image `hiennd23/backoffice-{api,web}:local` build 11:00 cùng ngày, sau commit `f3991fd5` (025 FR-011, 10:54): đủ mới
  cho bộ deploy (026 không đổi code).
- Không có project `bo-deploy` nào đang chạy; cổng 8090, 8091, 8095 rảnh. `deploy/compose/.env.deploy-test` có sẵn
  (38 dòng, global setup dùng lại).
- `docker compose config` sau T004, T005: mặc định `lb` 8090:8080 + 8091:8081, `lb/shared.conf`, hai service Backoffice
  khác env Directus đúng `PUBLIC_URL=http://localhost:8091`; standalone không `directus`, `lb` chỉ 8090:8080,
  `backoffice-api.environment` = `bootstrap.environment`, `PUBLIC_URL` của `.env` (8090); shared-extensions hợp lệ.
- `pnpm nx run-many -t lint,typecheck -p parity-tests` xanh; prettier sửa `domains.test.ts` (file đổi tên).

## Kết quả T015 (2026-10-28, local, image `:local`)

- Lượt mặc định (`pnpm nx run parity-tests:deploy`, 13:47–13:51): 55/66 test đạt, 7 skip (standalone), 4 đỏ:
  - `image-swap` và `web-image` "carries the version labels": image build local không có
    `org.opencontainers.image.revision` (`unknown`); CI build qua `nx-container` có nhãn. Không liên quan 026, chỉ local.
  - `compose` "runs no main process as root": `bo-deploy-registry-1` (fixture registry giả của profile `extensions-test`,
    `node:22-alpine` chạy root). Compose 5.5.0 local liệt kê cả container của profile trong `ps` (CI ubuntu-latest
    không, test vẫn xanh ở CI). Sửa test: bỏ `-registry-1` khỏi danh sách (fixture, không phải service triển khai).
  - `extensions` "installed from the registry through Directus": `POST /extensions/registry/install` ở Directus trả 500
    một lần; chạy lại riêng (`extensions.test.ts`, `compose.test.ts`, 13:52–13:54) đạt (204). Lỗi tạm thời của Directus
    emulated amd64 trên arm64 [Inference]; theo dõi ở CI.
  - `domains.test.ts` (định tuyến hai domain, TUS 8091, FR-073, cookie, env chỉ `PUBLIC_URL`), `smoke`, `shutdown` (tải qua
    8091), `backoffice-permissions` (`/permissions/me`, `/backoffice/permissions` ở 8091), `sessions`, `schema`,
    `flows-schedule`, `tus`, `backoffice-migrations`: đạt.
- SC-005: global setup `up -d --wait` với image sẵn có ≈ 25–60 s (lượt chạy lại 13:52:51 → test bắt đầu trước 13:53:20);
  cả suite ≈ 4,5 phút.
- Lượt standalone (`DEPLOY_MODE=standalone`, 13:54–13:58, sau `down -v`): 38/66 đạt, 27 skip (Directus, `domains`,
  `image-swap`, `extensions`), 1 đỏ (`web-image` nhãn revision, local như trên). Override standalone với `!reset`,
  `!override`: `lb` chỉ 8090, `config.json` `apiUrl` 8090, env replica = env `bootstrap`.

## Đóng lượt 1 (2026-10-28)

- Commit `4d92fa84` (feat) sau ba commit docs (`ff626a1e`, `810c6327`, `9d8a7765`); push 14:24 sau khi phiên 022 OK và run
  `40643815956` của phiên khác xong; run CI `40649899202`, Semgrep `40649899253`; số run đã gửi phiên 021.
- `graphify update .` chạy sau khi sửa.
- CI `40649899202` xanh toàn bộ (kể cả `deploy` 2 lượt và `deploy-k8s` với chart chưa đổi); lượt 1 đóng.

## Kết quả lượt 2 (2026-10-28)

- Chart: `helm lint` sạch; `ci/test-template.sh` local 69 check đạt với `KUBECONFORM=true` (không có kubeconform local;
  CI chạy thật). Check "Ingress: no other path" lúc đầu đếm cả `path:` của probe → đếm theo `^ +- path: /`.
- Kind (T023): không có `kind` local → CI `deploy-k8s` (run ghi ở "Đóng lượt 2"). US3 kịch bản 2, 3 chưa kiểm tay: không
  có môi trường chung domain (FR-012).
- README: prettier `--write` sau khi sửa (bảng căn lại). SC-001: các chỗ còn nhắc nhãn/route cũ chỉ là mục chuyển đổi,
  check phủ định, bước giả lập US2-3 và chú thích (quickstart §5). SC-007: kiểm theo đoạn (awk `RS=""`) vì ghi chú đứng
  cuối đoạn; đạt.
- Ghi chú "(026: ...)" thêm ở 003 (6), 004 (1), 014 (2), 020 (9), 021 (3), 023 (6), 024 (7), 025 (10): 44 chỗ, không đổi
  nội dung cũ.
- Phát hiện của phiên 022 trước khi push (15:35): `tests/parity/src/accepted-differences.test.ts` (job `quality`,
  FR-101 của 011) đọc ô "Gỡ ở" của mỗi dòng D-xxx; ghi chú "(026: ...)" đặt trong ô đó làm 6 mã lệch (D-24, D-137,
  D-184, D-188, D-189.1, D-189.7). Sửa: ghi chú chuyển sang ô "Lý do"; D-189.7 ghi "Gỡ ở" = `026` và entry của nó bị
  xóa khỏi `accepted-differences.ts` (khác biệt không còn: không lb/Ingress nào định tuyến riêng). Test xanh (5/5).
